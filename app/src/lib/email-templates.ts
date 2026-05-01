export interface Standing {
  participantId: string;
  teamName: string;
  totalPoints: number;
  yesterdayPoints: number;
  roster: {
    playerId: string;
    playerName: string;
    team: string;
    position: string;
    round: number;
    goals: number;
    assists: number;
    points: number;
    gamesPlayed: number;
    yesterdayGoals: number;
    yesterdayAssists: number;
    yesterdayPoints: number;
  }[];
}

export interface TonightGame {
  gameId: number;
  away: string;
  home: string;
  awayLogo?: string;
  homeLogo?: string;
  time: string;
  gameState?: string;
}

const NHL_ESPN_SLUGS: Record<string, string> = {
  ANA: 'ana', BOS: 'bos', BUF: 'buf', CAR: 'car', CBJ: 'cbj', CGY: 'cgy',
  CHI: 'chi', COL: 'col', DAL: 'dal', DET: 'det', EDM: 'edm', FLA: 'fla',
  LAK: 'la', MIN: 'min', MTL: 'mtl', NJD: 'nj', NSH: 'nsh', NYI: 'nyi',
  NYR: 'nyr', OTT: 'ott', PHI: 'phi', PIT: 'pit', SEA: 'sea', SJS: 'sj',
  STL: 'stl', TBL: 'tb', TOR: 'tor', UTA: 'uta', VAN: 'van', VGK: 'vgk',
  WPG: 'wpg', WSH: 'wsh',
};

function getLogoUrl(team: string): string {
  const slug = NHL_ESPN_SLUGS[team.toUpperCase()] ?? team.toLowerCase();
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/${slug}.png`;
}

function getMedal(rank: number): string {
  if (rank === 1) return '&#x1F947;';
  if (rank === 2) return '&#x1F948;';
  if (rank === 3) return '&#x1F949;';
  return '';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ordinal(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

export function generateDailyEmailSubject(draftName: string): string {
  return `${draftName} — Yesterday's Results & Tonight's Games`;
}

interface EmailParams {
  draftName: string;
  seasonType: string;
  date: string;
  standings: Standing[];
  myStanding: Standing;
  myRank: number;
  myPlayersYesterday: {
    playerName: string;
    team: string;
    opponent: string;
    result: string;
    points: number;
    goals: number;
    assists: number;
  }[];
  totalRosterSize: number;
  tonightGames: TonightGame[];
  myPlayersTonight: Map<number, { name: string; position: string; team: string }[]>;
  standingsUrl: string;
  recapUrl: string;
}

export function generateDailyEmailHtml(params: EmailParams): string {
  const {
    draftName,
    seasonType,
    date,
    standings,
    myStanding,
    myRank,
    myPlayersYesterday,
    totalRosterSize,
    tonightGames,
    myPlayersTonight,
    standingsUrl,
    recapUrl,
  } = params;

  const gamesBack = standings.length > 0
    ? Math.max(0, standings[0].totalPoints - myStanding.totalPoints)
    : 0;

  const playersPlayedCount = myPlayersYesterday.length;

  const headerSection = `
    <div style="background: linear-gradient(135deg, #1a3d1a, #0a0f0a); padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <div style="font-size: 28px; margin-bottom: 4px;">&#127953;</div>
      <div style="color: #c8d9c3; font-size: 18px; font-weight: bold; letter-spacing: 1px;">TOP SHELF DRAFT</div>
      <div style="color: #5a6b57; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px;">Daily Update</div>
      <div style="color: #c8d9c3; font-size: 16px; font-weight: bold; margin-top: 8px;">${escapeHtml(draftName)}</div>
      <div style="color: #5a6b57; font-size: 13px; margin-top: 4px;">${escapeHtml(seasonType === 'playoffs' ? 'Playoffs' : 'Regular Season')} &middot; ${escapeHtml(date)}</div>
    </div>`;

  const statsCards = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 16px 16px 8px;">
      <tr>
        <td width="25%" style="padding: 0 4px;">
          <div style="background: #0a0f0a; border: 1px solid #141e12; border-radius: 8px; padding: 12px 4px; text-align: center;">
            <div style="font-size: 10px; color: #5a6b57; text-transform: uppercase; letter-spacing: 1px;">Position</div>
            <div style="font-size: 18px; font-weight: bold; color: #c8d9c3; margin-top: 4px;">${getMedal(myRank)} ${myRank}${ordinal(myRank)}</div>
          </div>
        </td>
        <td width="25%" style="padding: 0 4px;">
          <div style="background: #0a0f0a; border: 1px solid #141e12; border-radius: 8px; padding: 12px 4px; text-align: center;">
            <div style="font-size: 10px; color: #5a6b57; text-transform: uppercase; letter-spacing: 1px;">Total Pts</div>
            <div style="font-size: 18px; font-weight: bold; color: #c8d9c3; margin-top: 4px;">${myStanding.totalPoints}</div>
          </div>
        </td>
        <td width="25%" style="padding: 0 4px;">
          <div style="background: #0a0f0a; border: 1px solid #141e12; border-radius: 8px; padding: 12px 4px; text-align: center;">
            <div style="font-size: 10px; color: #5a6b57; text-transform: uppercase; letter-spacing: 1px;">Yesterday</div>
            <div style="font-size: 18px; font-weight: bold; color: #6b9b7a; margin-top: 4px;">+${myStanding.yesterdayPoints}</div>
          </div>
        </td>
        <td width="25%" style="padding: 0 4px;">
          <div style="background: #0a0f0a; border: 1px solid #141e12; border-radius: 8px; padding: 12px 4px; text-align: center;">
            <div style="font-size: 10px; color: #5a6b57; text-transform: uppercase; letter-spacing: 1px;">Games Back</div>
            <div style="font-size: 18px; font-weight: bold; color: #c8d9c3; margin-top: 4px;">${gamesBack}</div>
          </div>
        </td>
      </tr>
    </table>`;

  let playersSection: string;
  if (playersPlayedCount === 0) {
    playersSection = `
      <div style="padding: 16px;">
        <div style="font-size: 14px; font-weight: bold; color: #6b9b7a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Your Players Yesterday</div>
        <div style="background: #0a0f0a; border: 1px solid #141e12; border-radius: 8px; padding: 20px; text-align: center; color: #5a6b57; font-size: 14px;">
          No players were in action yesterday
        </div>
      </div>`;
  } else {
    const playerRows = myPlayersYesterday.map(p => {
      const gaParts: string[] = [];
      if (p.goals > 0) gaParts.push(`${p.goals}G`);
      if (p.assists > 0) gaParts.push(`${p.assists}A`);
      const gaText = gaParts.length > 0 ? ` (${gaParts.join(', ')})` : '';

      return `
        <tr>
          <td style="padding: 8px 0; vertical-align: middle;">
            <img src="${getLogoUrl(p.team)}" width="20" height="20" style="display: inline-block; vertical-align: middle; margin-right: 8px;" alt="${escapeHtml(p.team)}" />
            <span style="font-weight: 500; color: #c8d9c3;">${escapeHtml(p.playerName)}</span>
          </td>
          <td style="padding: 8px 4px; text-align: center; color: #5a6b57; font-size: 13px;">${escapeHtml(p.opponent ? `vs ${p.opponent}` : '')}</td>
          <td style="padding: 8px 0; text-align: right;">
            <span style="color: #6b9b7a; font-weight: bold;">+${p.points}</span>
            <span style="color: #5a6b57; font-size: 12px;">${gaText}</span>
          </td>
        </tr>`;
    }).join('');

    playersSection = `
      <div style="padding: 16px;">
        <div style="font-size: 14px; font-weight: bold; color: #6b9b7a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Your Players Yesterday</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${playerRows}
        </table>
        <div style="margin-top: 8px; font-size: 12px; color: #5a6b57; text-align: center;">
          ${playersPlayedCount} of your ${totalRosterSize} players were in action yesterday
        </div>
      </div>`;
  }

  let tonightsGamesSection: string;
  if (tonightGames.length === 0) {
    tonightsGamesSection = `
      <div style="padding: 16px;">
        <div style="font-size: 14px; font-weight: bold; color: #6b9b7a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Tonight's Games</div>
        <div style="background: #0a0f0a; border: 1px solid #141e12; border-radius: 8px; padding: 20px; text-align: center; color: #5a6b57; font-size: 14px;">
          No games scheduled for tonight
        </div>
      </div>`;
  } else {
    const gameCards = tonightGames.map(game => {
      const myPlayers = myPlayersTonight.get(game.gameId) ?? [];
      const hasMyPlayers = myPlayers.length > 0;

      const borderColor = hasMyPlayers ? '#4a7c59' : '#141e12';

      const playersList = hasMyPlayers
        ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #141e12;">
            <div style="font-size: 10px; color: #6b9b7a; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Your Players</div>
            ${myPlayers.map(p => `<div style="font-size: 13px; color: #c8d9c3; padding: 2px 0;">${escapeHtml(p.name)} <span style="color: #5a6b57;">&middot; ${escapeHtml(p.position)} &middot; ${escapeHtml(p.team)}</span></div>`).join('')}
           </div>`
        : '';

      return `
        <div style="background: #0a0f0a; border: 1px solid ${borderColor}; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: middle;">
                <img src="${getLogoUrl(game.away)}" width="22" height="22" style="display: inline-block; vertical-align: middle; margin-right: 6px;" alt="${escapeHtml(game.away)}" />
                <span style="font-weight: 600; color: #c8d9c3; font-size: 14px;">${escapeHtml(game.away)}</span>
              </td>
              <td style="text-align: center; vertical-align: middle; width: 40px;">
                <span style="color: #5a6b57; font-size: 12px; font-weight: 600;">@</span>
              </td>
              <td style="vertical-align: middle; text-align: right;">
                <span style="font-weight: 600; color: #c8d9c3; font-size: 14px;">${escapeHtml(game.home)}</span>
                <img src="${getLogoUrl(game.home)}" width="22" height="22" style="display: inline-block; vertical-align: middle; margin-left: 6px;" alt="${escapeHtml(game.home)}" />
              </td>
            </tr>
          </table>
          <div style="text-align: center; color: #5a6b57; font-size: 12px; margin-top: 4px;">${escapeHtml(game.time)}</div>
          ${playersList}
        </div>`;
    }).join('');

    tonightsGamesSection = `
      <div style="padding: 16px;">
        <div style="font-size: 14px; font-weight: bold; color: #6b9b7a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Tonight's Games</div>
        ${gameCards}
      </div>`;
  }

  const allStandings = [...standings];
  const standingsRows = allStandings.map((s, i) => {
    const rank = i + 1;
    const isMe = s.participantId === myStanding.participantId;
    const rowBg = isMe ? '#1a3d1a' : (i % 2 === 0 ? '#050a05' : '#0a0f0a');

    return `
      <tr style="background: ${rowBg};">
        <td style="padding: 8px 8px; font-weight: ${isMe ? 'bold' : 'normal'}; color: #c8d9c3; text-align: center; width: 40px;">${getMedal(rank)} ${rank}</td>
        <td style="padding: 8px 8px; font-weight: ${isMe ? 'bold' : 'normal'}; color: #c8d9c3;">${escapeHtml(s.teamName)}${isMe ? ' (You)' : ''}</td>
        <td style="padding: 8px 8px; text-align: right; font-weight: ${isMe ? 'bold' : 'normal'}; color: #c8d9c3; width: 50px;">${s.totalPoints}</td>
        <td style="padding: 8px 8px; text-align: right; color: #6b9b7a; font-weight: ${isMe ? 'bold' : 'normal'}; width: 50px;">+${s.yesterdayPoints}</td>
      </tr>`;
  }).join('');

  const standingsSection = `
    <div style="padding: 16px;">
      <div style="font-size: 14px; font-weight: bold; color: #6b9b7a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Standings</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #4a7c59;">
            <th style="padding: 8px 8px; text-align: center; color: #c8d9c3; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">#</th>
            <th style="padding: 8px 8px; text-align: left; color: #c8d9c3; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Team</th>
            <th style="padding: 8px 8px; text-align: right; color: #c8d9c3; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Pts</th>
            <th style="padding: 8px 8px; text-align: right; color: #c8d9c3; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Yest</th>
          </tr>
        </thead>
        <tbody>
          ${standingsRows}
        </tbody>
      </table>
      <div style="text-align: center; margin-top: 16px;">
        <a href="${escapeHtml(standingsUrl)}" style="display: inline-block; background: #4a7c59; color: #c8d9c3; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">View Full Standings</a>
      </div>
    </div>`;

  const footerSection = `
    <div style="padding: 16px; text-align: center; border-top: 1px solid #141e12; margin-top: 8px;">
      <div style="font-size: 12px; color: #5a6b57; margin-bottom: 8px;">&#127953; Top Shelf Draft</div>
      <a href="${escapeHtml(recapUrl)}" style="color: #6b9b7a; text-decoration: none; font-size: 13px; margin: 0 12px;">Draft Recap</a>
      <a href="${escapeHtml(standingsUrl)}" style="color: #6b9b7a; text-decoration: none; font-size: 13px; margin: 0 12px;">Standings</a>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #050a05; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; background: #050a05; border: 1px solid #141e12; border-radius: 8px; overflow: hidden;">
    ${headerSection}
    ${statsCards}
    <div style="height: 1px; background: #141e12; margin: 0 16px;"></div>
    ${playersSection}
    <div style="height: 1px; background: #141e12; margin: 0 16px;"></div>
    ${tonightsGamesSection}
    <div style="height: 1px; background: #141e12; margin: 0 16px;"></div>
    ${standingsSection}
    ${footerSection}
  </div>
</body>
</html>`;
}
