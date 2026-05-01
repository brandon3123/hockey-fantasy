import { Resend } from 'resend';
import { generateDailyEmailHtml, generateDailyEmailSubject } from './email-templates';
import type { Standing, TonightGame } from './email-templates';

export type { Standing, TonightGame };

interface ParticipantWithEmail {
  email: string;
  participantId: string;
  teamName: string;
}

interface SendDailyEmailsParams {
  draftId: string;
  draftName: string;
  seasonType: string;
  date: string;
  standings: Standing[];
  tonightGames: TonightGame[];
  participantsWithEmail: ParticipantWithEmail[];
  baseUrl: string;
}

export async function sendDailyEmails(
  params: SendDailyEmailsParams
): Promise<{ sent: number; errors: string[] }> {
  const {
    draftId,
    draftName,
    seasonType,
    date,
    standings,
    tonightGames,
    participantsWithEmail,
    baseUrl,
  } = params;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@yourdomain.com';
  const subject = generateDailyEmailSubject(draftName);
  const standingsUrl = `${baseUrl}/draft/${draftId}/standings`;
  const recapUrl = `${baseUrl}/draft/${draftId}/recap`;

  console.log(`Sending emails for draft "${draftName}" from ${fromEmail} to ${participantsWithEmail.length} participants`);
  for (const p of participantsWithEmail) {
    console.log(`  - ${p.teamName}: ${p.email}`);
  }

  let sent = 0;
  const errors: string[] = [];

  for (const participant of participantsWithEmail) {
    try {
      const standing = standings.find(s => s.participantId === participant.participantId);
      if (!standing) {
        errors.push(`No standing found for participant ${participant.participantId}`);
        continue;
      }

      const rank = standings.findIndex(s => s.participantId === participant.participantId) + 1;

      const myPlayersYesterday = standing.roster
        .filter(p => p.yesterdayPoints > 0)
        .map(p => {
          const game = tonightGames.find(
            g => g.away === p.team || g.home === p.team
          );
          const opponent = game
            ? game.away === p.team
              ? game.home
              : game.away
            : '';
          return {
            playerName: p.playerName,
            team: p.team,
            opponent,
            result: '',
            points: p.yesterdayPoints,
            goals: p.yesterdayGoals,
            assists: p.yesterdayAssists,
          };
        });

      const myPlayersTonight = new Map<number, { name: string; position: string; team: string }[]>();
      for (const game of tonightGames) {
        const matchingPlayers = standing.roster.filter(
          p => p.team === game.away || p.team === game.home
        );
        if (matchingPlayers.length > 0) {
          myPlayersTonight.set(game.gameId, matchingPlayers.map(p => ({
            name: p.playerName,
            position: p.position,
            team: p.team,
          })));
        }
      }

      const html = generateDailyEmailHtml({
        draftName,
        seasonType,
        date,
        standings,
        myStanding: standing,
        myRank: rank,
        myPlayersYesterday,
        totalRosterSize: standing.roster.length,
        tonightGames,
        myPlayersTonight,
        standingsUrl,
        recapUrl,
      });

      const { data, error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: participant.email,
        subject,
        html,
      });

      if (sendError) {
        errors.push(`Failed to send to ${participant.email}: ${sendError.message}`);
        continue;
      }

      console.log(`Email sent to ${participant.email}: ${data?.id}`);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to send to ${participant.email}: ${message}`);
    }
  }

  return { sent, errors };
}
