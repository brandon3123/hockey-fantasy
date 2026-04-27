'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Player } from '@/types/player'
import { useDraftRealtime, DraftPickRow } from './useDraftRealtime'

export type { DraftPickRow } from './useDraftRealtime'

export interface DraftData {
  id: string
  name: string
  season_type: string
  status: string
  draft_date: string | null
  draft_time: string | null
  location: string | null
  entry_fee: number
  currency: string
  payment_method: string | null
  payment_info: string | null
  notes: string | null
  players_per_team: number
  scoring_format: string
  admin_user_id: string
  current_round: number
  current_pick: number
  pick_entry_mode: string | null
  pick_timer_seconds: number | null
  created_at: string
}

export interface ParticipantData {
  id: string
  user_id: string
  team_name: string
  draft_position: number | null
  has_paid: boolean
  created_at: string
}

interface PlayerRow {
  name: string
  team: string
  position: string
  regular_season_goals: number
  regular_season_assists: number
  games_played: number
  points_per_game: number
  last_10_goals: number | null
  last_10_assists: number | null
  last_10_games: number | null
  last_20_goals: number | null
  last_20_assists: number | null
  last_20_games: number | null
  team_advancement_r1: number
  team_advancement_r2: number
  team_advancement_r3: number
  team_advancement_r4: number
  projected_playoff_games: number
  projected_playoff_points: number
  rank: number
  adp: number | null
  injury_status: string
  injury_expected_return: string | null
  injury_description: string | null
}

function mapPlayerRow(row: PlayerRow): Player {
  return {
    name: row.name,
    team: row.team,
    position: row.position as Player['position'],
    regularSeasonGoals: row.regular_season_goals,
    regularSeasonAssists: row.regular_season_assists,
    gamesPlayed: row.games_played,
    pointsPerGame: row.points_per_game,
    last10Games: row.last_10_games != null
      ? {
          goals: row.last_10_goals ?? 0,
          assists: row.last_10_assists ?? 0,
          points: (row.last_10_goals ?? 0) + (row.last_10_assists ?? 0),
          games: row.last_10_games,
        }
      : undefined,
    last20Games: row.last_20_games != null
      ? {
          goals: row.last_20_goals ?? 0,
          assists: row.last_20_assists ?? 0,
          points: (row.last_20_goals ?? 0) + (row.last_20_assists ?? 0),
          games: row.last_20_games,
        }
      : undefined,
    teamAdvancementOdds: {
      round1: row.team_advancement_r1,
      round2: row.team_advancement_r2,
      round3: row.team_advancement_r3,
      round4: row.team_advancement_r4,
    },
    projectedPlayoffGames: row.projected_playoff_games,
    projectedPlayoffPoints: row.projected_playoff_points,
    rank: row.rank,
    adp: row.adp ?? undefined,
    injury: {
      status: row.injury_status as Player['injury']['status'],
      expectedReturn: row.injury_expected_return,
      description: row.injury_description,
    },
  }
}

export function useDraftState(draftId: string) {
  const [draft, setDraft] = useState<DraftData | null>(null)
  const [participants, setParticipants] = useState<ParticipantData[]>([])
  const [picks, setPicks] = useState<DraftPickRow[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchDraftData = useCallback(async () => {
    const res = await fetch(`/api/drafts/${draftId}`)
    if (res.ok) {
      const data = await res.json()
      setDraft(data.draft)
      setParticipants(data.participants || [])
      setPicks(data.picks || [])
      setIsAdmin(data.is_admin)
    }
  }, [draftId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const supabase = createClient()

      const [authResult, draftRes, playersResult] = await Promise.all([
        supabase.auth.getUser(),
        fetch(`/api/drafts/${draftId}`),
        supabase.from('players').select('*').order('projected_playoff_points', { ascending: false }),
      ])

      setCurrentUserId(authResult.data.user?.id ?? null)

      if (playersResult.data) {
        setPlayers(playersResult.data.map(mapPlayerRow))
      }

      if (draftRes.ok) {
        const data = await draftRes.json()
        setDraft(data.draft)
        setParticipants(data.participants || [])
        setPicks(data.picks || [])
        setIsAdmin(data.is_admin)
      }

      setLoading(false)
    }

    load()
  }, [draftId])

  const refresh = useCallback(async () => {
    await fetchDraftData()
  }, [fetchDraftData])

  useDraftRealtime({
    draftId,
    onPickAdded: useCallback((pick: DraftPickRow) => {
      setPicks(prev => [...prev, pick])
      fetchDraftData()
    }, [fetchDraftData]),
    onPickRemoved: useCallback((pickId: string) => {
      setPicks(prev => prev.filter(p => p.id !== pickId))
      fetchDraftData()
    }, [fetchDraftData]),
  })

  const pickedPlayerSlugs = new Set(
    picks.map(p => p.player_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  )
  const availablePlayers = players.filter(
    p => !pickedPlayerSlugs.has(p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  )

  const managers = participants.length
  const currentRound = draft?.current_round ?? 1
  const currentPick = draft?.current_pick ?? 1
  const isReverseRound = currentRound % 2 === 0
  const currentPosition = managers > 0
    ? isReverseRound ? managers - currentPick + 1 : currentPick
    : 0
  const currentParticipant = participants.find(p => p.draft_position === currentPosition) ?? null
  const isDraftComplete = draft?.status === 'complete' || currentRound > (draft?.players_per_team ?? 0)

  return {
    draft,
    participants,
    picks,
    players,
    availablePlayers,
    loading,
    isAdmin,
    currentUserId,
    managers,
    currentRound,
    currentPick,
    currentPosition,
    currentParticipant,
    isDraftComplete,
    refresh,
  }
}
