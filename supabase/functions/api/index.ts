import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticatedUser, corsHeaders, jsonResponse } from '../_shared/http.ts'

const url = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const user = await authenticatedUser(req, url, anonKey)
    if (!user) return jsonResponse({ error: 'No autorizado' }, 401)
    const db = createClient(url, serviceKey)

    if (req.method === 'GET') {
      const [transactions, members, attendance] = await Promise.all([
        db.from('transactions').select('transaction_date, person, type, amount, concept').order('transaction_date', { ascending: false }),
        db.from('members').select('name').eq('active', true).order('name'),
        db.from('attendance').select('attendance_date, event, member_name, status').order('attendance_date', { ascending: false }),
      ])
      const failure = transactions.error || members.error || attendance.error
      if (failure) throw failure
      const debts = (transactions.data || []).map(toLegacyTransaction)
      return jsonResponse({
        transactions: debts.filter(row => row.tipo === 'aporte' || row.tipo === 'gasto'),
        debts,
        members: (members.data || []).map(row => row.name),
        attendance: (attendance.data || []).map(row => ({ fecha: formatDate(row.attendance_date), evento: row.event, miembro: row.member_name, estado: row.status })),
      })
    }

    const payload = await req.json()
    if (payload.action === 'add') {
      const { error } = await db.from('transactions').insert({
        transaction_date: parseDate(payload.fecha), person: requiredText(payload.persona, 'persona'),
        type: payload.tipo, amount: Number(payload.monto), concept: requiredText(payload.concepto, 'concepto'),
      })
      if (error) throw error
    } else if (payload.action === 'save_attendance') {
      if (!Array.isArray(payload.registros)) return jsonResponse({ error: 'registros debe ser una lista' }, 400)
      const date = parseDate(payload.fecha)
      const event = payload.evento || 'Reunión General'
      const { error } = await db.rpc('save_attendance', {
        p_date: date,
        p_event: event,
        p_records: payload.registros.map((row: { miembro: string; estado: string }) => ({ member_name: row.miembro, status: row.estado })),
      })
      if (error) throw error
    } else if (payload.action === 'emit_cuota_jueves') {
      if (!Array.isArray(payload.asistentes)) return jsonResponse({ error: 'asistentes debe ser una lista' }, 400)
      const { error } = await db.from('transactions').insert(payload.asistentes.map((person: string) => ({ transaction_date: parseDate(payload.fecha), person, type: 'cuota_jueves', amount: Number(payload.monto), concept: payload.concepto || 'Cuota Jueves Santo' })))
      if (error) throw error
    } else {
      return jsonResponse({ error: 'Acción no reconocida' }, 400)
    }
    return jsonResponse({ status: 'success' })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Error interno' }, 400)
  }
})

function requiredText(value: unknown, field: string) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} es obligatorio`)
  return text
}

function parseDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  throw new Error('Fecha inválida')
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function toLegacyTransaction(row: { transaction_date: string; person: string; type: string; amount: number; concept: string }) {
  return { fecha: formatDate(row.transaction_date), persona: row.person, tipo: row.type, monto: Number(row.amount), concepto: row.concept }
}
