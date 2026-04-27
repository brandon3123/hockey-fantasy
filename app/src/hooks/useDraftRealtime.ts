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
  onPickRemoved?: () => void
}

export function useDraftRealtime({ draftId, onPickAdded, onPickRemoved }: UseDraftRealtimeOptions) {
  const onPickAddedRef = useRef(onPickAdded)
  const onPickRemovedRef = useRef(onPickRemoved)
  const knownPickIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    onPickAddedRef.current = onPickAdded
    onPickRemovedRef.current = onPickRemoved
  })

  const trackPick = (pick: DraftPickRow) => {
    knownPickIdsRef.current.add(pick.id)
  }

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
          const pick = payload.new as DraftPickRow
          trackPick(pick)
          onPickAddedRef.current?.(pick)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'draft_picks',
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          if (knownPickIdsRef.current.has(deletedId)) {
            knownPickIdsRef.current.delete(deletedId)
            onPickRemovedRef.current?.()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [draftId])
}
