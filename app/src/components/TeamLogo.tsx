interface TeamLogoProps {
  team: string;
  className?: string;
}

export default function TeamLogo({ team, className = '' }: TeamLogoProps) {
  const teamAbbreviation = team.toUpperCase();

  // Using reliable sports logo sources
  const getTeamLogoUrl = (team: string): string => {
    const teamLogos: { [key: string]: string } = {
      'ANA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/ana.png',
      'BOS': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/bos.png',
      'BUF': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/buf.png',
      'CAR': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/car.png',
      'CBJ': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/cbj.png',
      'CGY': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/cgy.png',
      'CHI': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/chi.png',
      'COL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/col.png',
      'DAL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/dal.png',
      'DET': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/det.png',
      'EDM': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/edm.png',
      'FLA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/fla.png',
      'LAK': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/la.png',
      'MIN': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/min.png',
      'MTL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/mtl.png',
      'NJD': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nj.png',
      'NSH': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nsh.png',
      'NYI': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nyi.png',
      'NYR': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nyr.png',
      'OTT': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/ott.png',
      'PHI': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/phi.png',
      'PIT': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/pit.png',
      'SEA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/sea.png',
      'SJS': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/sj.png',
      'STL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/stl.png',
      'TBL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/tb.png',
      'TOR': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/tor.png',
      'UTA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/uta.png',
      'VAN': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/van.png',
      'VGK': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/vgk.png',
      'WPG': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/wpg.png',
      'WSH': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/wsh.png',
    };

    return teamLogos[team] || '';
  };

  const logoUrl = getTeamLogoUrl(teamAbbreviation);

  if (!logoUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-700 text-white text-xs ${className}`} style={{
        width: '36px',
        height: '36px',
        borderRadius: '4px',
        fontSize: '10px'
      }}>
        {teamAbbreviation}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{
      width: '36px',
      height: '36px'
    }}>
      <img
        src={logoUrl}
        alt={teamAbbreviation}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          maxWidth: '36px',
          maxHeight: '36px'
        }}
        onError={(e) => {
          // Fallback to abbreviation if logo fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          if (target.parentElement) {
            target.parentElement.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#374151;color:white;font-size:10px;border-radius:4px;">${teamAbbreviation}</div>`;
          }
        }}
      />
    </div>
  );
}