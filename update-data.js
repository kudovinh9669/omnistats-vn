// File: update-data.js
const fs = require('fs');

const API_KEYS = {
    football: "3ee68834d24b1ff67f2e3a11e96ba7b3",
    pandascore: "GL34SKb3w6rAjms-2PIMj-nJf-gV0eznazLB46Xz4IpWbxkcNNA",
    nba: "7c98c132-8759-4186-b885-a88a2a4d5068"
};

async function fetchAllData() {
    console.log("Bắt đầu đồng bộ dữ liệu API...");
    let matchesToRender = [];

    try {
        const [footballRes, esportsRes, nbaRes] = await Promise.allSettled([
            fetch('https://v3.football.api-sports.io/fixtures?team=42&last=1', { headers: { 'x-apisports-key': API_KEYS.football } }),
            fetch('https://api.pandascore.co/lol/matches/past?sort=-end_at&per_page=1', { headers: { 'Authorization': `Bearer ${API_KEYS.pandascore}` } }),
            fetch('https://api.balldontlie.io/v1/games?per_page=1', { headers: { 'Authorization': API_KEYS.nba } })
        ]);

        // Xử lý API-Football
        if (footballRes.status === 'fulfilled') {
            const fbData = await footballRes.value.json();
            if (fbData.response && fbData.response.length > 0) {
                const match = fbData.response[0];
                matchesToRender.push({
                    type: 'football', league: match.league.name,
                    time: match.fixture.status.elapsed ? `${match.fixture.status.elapsed}'` : 'FT',
                    teamHome: { name: match.teams.home.name, logo: match.teams.home.logo },
                    teamAway: { name: match.teams.away.name, logo: match.teams.away.logo },
                    scoreHome: match.goals.home ?? 0, scoreAway: match.goals.away ?? 0
                });
            }
        }

        // Xử lý PandaScore
        if (esportsRes.status === 'fulfilled') {
            const esData = await esportsRes.value.json();
            if (esData && esData.length > 0) {
                const match = esData[0];
                const opp1 = match.opponents[0]?.opponent;
                const opp2 = match.opponents[1]?.opponent;
                matchesToRender.push({
                    type: 'esports', league: match.league.name, time: 'LIVE',
                    teamHome: { name: opp1?.acronym || opp1?.name, logo: opp1?.image_url || `https://ui-avatars.com/api/?name=${opp1?.name}&background=random` },
                    teamAway: { name: opp2?.acronym || opp2?.name, logo: opp2?.image_url || `https://ui-avatars.com/api/?name=${opp2?.name}&background=random` },
                    scoreHome: match.results[0]?.score || 0, scoreAway: match.results[1]?.score || 0
                });
            }
        }

        // Xử lý Balldontlie
        if (nbaRes.status === 'fulfilled') {
            const nbaData = await nbaRes.value.json();
            if (nbaData.data && nbaData.data.length > 0) {
                const match = nbaData.data[0];
                matchesToRender.push({
                    type: 'basketball', league: 'NBA', time: match.status,
                    teamHome: { name: match.home_team.abbreviation, logo: `https://ui-avatars.com/api/?name=${match.home_team.abbreviation}&background=random&color=fff&bold=true` },
                    teamAway: { name: match.visitor_team.abbreviation, logo: `https://ui-avatars.com/api/?name=${match.visitor_team.abbreviation}&background=random&color=fff&bold=true` },
                    scoreHome: match.home_team_score || 0, scoreAway: match.visitor_team_score || 0
                });
            }
        }

        // Lưu toàn bộ mảng data thành file JSON vật lý
        fs.writeFileSync('live-matches.json', JSON.stringify(matchesToRender, null, 2));
        console.log("Cập nhật thành công live-matches.json!");

    } catch (error) {
        console.error("Lỗi đồng bộ:", error);
    }
}

fetchAllData();