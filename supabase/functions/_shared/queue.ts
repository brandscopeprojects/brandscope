// pgmq access via SECURITY DEFINER wrapper RPCs (created in migration 13). We do
// not touch the pgmq schema directly from the client — the wrappers keep the
// surface small and auditable.

import type { SupabaseClient } from "./supabase.ts";

/** Enqueue a message onto a pgmq queue. Returns the message id. */
export async function queueSend(
  sb: SupabaseClient,
  queue: string,
  message: unknown,
): Promise<number | null> {
  const { data, error } = await sb.rpc("app_pgmq_send", { p_queue: queue, p_message: message });
  if (error) throw new Error(`queueSend(${queue}): ${error.message}`);
  return (data as number) ?? null;
}

export type QueueMessage<T> = { msgId: number; message: T };

/** Read up to one message, making it invisible for `vtSeconds`. */
export async function queueReadOne<T>(
  sb: SupabaseClient,
  queue: string,
  vtSeconds = 90,
): Promise<QueueMessage<T> | null> {
  const { data, error } = await sb.rpc("app_pgmq_read", {
    p_queue: queue,
    p_vt: vtSeconds,
    p_qty: 1,
  });
  if (error) throw new Error(`queueReadOne(${queue}): ${error.message}`);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return { msgId: row.msg_id as number, message: row.message as T };
}

/** Archive a processed message (success). */
export async function queueArchive(
  sb: SupabaseClient,
  queue: string,
  msgId: number,
): Promise<void> {
  const { error } = await sb.rpc("app_pgmq_archive", { p_queue: queue, p_msg_id: msgId });
  if (error) throw new Error(`queueArchive(${queue}): ${error.message}`);
}
