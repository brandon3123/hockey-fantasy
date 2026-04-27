'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface DraftPickRow {
  id: string
  draft_id: string
  round: number
  pick_number: number
  manager_index: number
  participant_id: string
  player_id: string
  player_name: string
  created_at: string
}

interface UseDraftRealtimeOptions {
  draftId: string
  onPickAdded?: (pick: DraftPickRow) => void
  onPickRemoved?: (pickId: string) => void
}

export function useDraftRealtime({ draftId, onPickAdded, onPickRemoved }: UseDraftRealtimeOptions) {
  const onPickAddedRef = useRef(onPickAdded)
  const onPickRemovedRef = useRef(onPickRemoved)

  useEffect(() => {
    onPickAddedRef.current = onPickAdded
    onPickRemovedRef.current = onPickRemoved
  })

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`draft:${draftId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'draft_picks',
          filter: `draft_id=eq.${draftId}`,
        },
        (payload) => {
          onPickAddedRef.current?.(payload.new as DraftPickRow)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'draft_picks',
        },
        () => {
          onPickRemovedRef.current?.('')
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [draftId])
}
