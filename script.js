// ==========================================
// LUCKYVERSE - Core JavaScript
// ==========================================

const INITIAL_BALANCE = 10000;

// Default State Structure
const DEFAULT_STATE = {
    username: 'Player',
    avatar: '👤',
    balance: INITIAL_BALANCE,
    theme: 'neon',
    soundEnabled: true,
    animEnabled: true,
    stats: {
        totalGames: 0,
        totalWins: 0,
        totalLosses: 0,
        totalWon: 0,
        totalLost: 0,
        bestWin: 0,
        worstLoss: 0,
        streak: 0,
        bestStreak: 0,
        gameCounts: {} // e.g. 'Slot Machine': 5
    },
    history: [],
    achievements: [],
    favorites: [],
    lastRewardDay: 0,
    lastRewardTime: null,
    joinDate: new Date().toLocaleDateString()
};

// ------------------------------------------
// STORAGE MANAGER
// ------------------------------------------
const Storage = {
    data: null,
    load: function() {
        const saved = localStorage.getItem('luckyverse_data');
        if (saved) {
            this.data = JSON.parse(saved);
            // Merge in case of new fields
            this.data = { ...DEFAULT_STATE, ...this.data, stats: { ...DEFAULT_STATE.stats, ...this.data.stats } };
        } else {
            this.data = JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
    },
    save: function() {
        localStorage.setItem('luckyverse_data', JSON.stringify(this.data));
    },
    reset: function() {
        localStorage.removeItem('luckyverse_data');
        this.load();
    }
};

// ------------------------------------------
// AUDIO MANAGER (Synthetic Web Audio)
// ------------------------------------------
const AudioSys = {
    ctx: null,
    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone: function(freq, type, duration) {
        if (!Storage.data.soundEnabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    win: function() { this.playTone(600, 'sine', 0.2); setTimeout(() => this.playTone(800, 'sine', 0.4), 200); },
    lose: function() { this.playTone(300, 'sawtooth', 0.4); },
    click: function() { this.playTone(1000, 'sine', 0.1); },
    spin: function() { this.playTone(400, 'square', 0.1); }
};

// ------------------------------------------
// NOTIFICATION & MODALS
// ------------------------------------------
const Notifications = {
    show: function(message, type = 'info') {
        const container = document.getElementById('notifications-container');
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.innerHTML = `<span class="noti-icon">${type === 'success' ? '🎉' : type === 'error' ? '⚠️' : '🔔'}</span> ${message}`;
        container.appendChild(notif);
        setTimeout(() => { if (notif.parentNode) notif.remove(); }, 5000);
        if (type === 'success') AudioSys.win();
        else if (type === 'error') AudioSys.lose();
    }
};

// ------------------------------------------
// WALLET & STATS MANAGER
// ------------------------------------------
const Wallet = {
    validateBet: function(amount) {
        if (isNaN(amount) || amount <= 0) {
            Notifications.show('Invalid bet amount.', 'error');
            return false;
        }
        if (amount > Storage.data.balance) {
            Notifications.show("⚠️ You don't have enough virtual coins.", 'error');
            return false;
        }
        return true;
    },
    deduct: function(amount) {
        Storage.data.balance -= amount;
        this.updateUI();
    },
    add: function(amount) {
        Storage.data.balance += amount;
        this.updateUI();
    },
    recordGame: function(gameName, bet, result, profitLoss) {
        // Update stats
        Storage.data.stats.totalGames++;
        Storage.data.stats.gameCounts[gameName] = (Storage.data.stats.gameCounts[gameName] || 0) + 1;
        
        if (result === 'win') {
            Storage.data.stats.totalWins++;
            Storage.data.stats.totalWon += profitLoss;
            if (profitLoss > Storage.data.stats.bestWin) Storage.data.stats.bestWin = profitLoss;
            Storage.data.stats.streak = Storage.data.stats.streak > 0 ? Storage.data.stats.streak + 1 : 1;
        } else if (result === 'loss') {
            Storage.data.stats.totalLosses++;
            Storage.data.stats.totalLost += Math.abs(profitLoss);
            if (Math.abs(profitLoss) > Storage.data.stats.worstLoss) Storage.data.stats.worstLoss = Math.abs(profitLoss);
            Storage.data.stats.streak = Storage.data.stats.streak < 0 ? Storage.data.stats.streak - 1 : -1;
        } else {
            // tie/push
            Storage.data.stats.streak = 0;
        }

        if (Storage.data.stats.streak > Storage.data.stats.bestStreak) {
            Storage.data.stats.bestStreak = Storage.data.stats.streak;
        }

        // Add history
        const now = new Date();
        Storage.data.history.unshift({
            game: gameName,
            bet: bet,
            result: result,
            profit: profitLoss,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString()
        });

        // Limit history size
        if (Storage.data.history.length > 100) Storage.data.history.pop();
        
        Storage.save();
        this.updateUI();
        Achievements.check();
    },
    updateUI: function() {
        document.getElementById('nav-balance').textContent = Storage.data.balance.toLocaleString();
        document.getElementById('home-stat-balance').textContent = '🪙 ' + Storage.data.balance.toLocaleString();
        document.getElementById('wallet-balance').textContent = Storage.data.balance.toLocaleString();
        document.getElementById('home-stat-games').textContent = Storage.data.stats.totalGames;
        document.getElementById('home-stat-wins').textContent = Storage.data.stats.totalWins;
        
        const winRate = Storage.data.stats.totalGames > 0 ? ((Storage.data.stats.totalWins / Storage.data.stats.totalGames) * 100).toFixed(1) : 0;
        document.getElementById('home-stat-winrate').textContent = winRate + '%';

        // Wallet view updates
        document.getElementById('wallet-won').textContent = '🟢 +' + Storage.data.stats.totalWon.toLocaleString();
        document.getElementById('wallet-lost').textContent = '🔴 -' + Storage.data.stats.totalLost.toLocaleString();
        document.getElementById('wallet-best-win').textContent = '🏆 +' + Storage.data.stats.bestWin.toLocaleString();
        document.getElementById('wallet-worst-loss').textContent = '💔 -' + Storage.data.stats.worstLoss.toLocaleString();
    },
    claimBonus: function() {
        const cooldown = 3600000; // 1 hour
        const lastClaim = localStorage.getItem('lucky_bonus_time');
        const now = Date.now();
        if (lastClaim && now - parseInt(lastClaim) < cooldown) {
            Notifications.show(`Bonus available in ${Math.ceil((cooldown - (now - parseInt(lastClaim)))/60000)} mins`, 'error');
            return;
        }
        this.add(1000);
        localStorage.setItem('lucky_bonus_time', now.toString());
        Notifications.show('Claimed 1,000 Demo Bonus!', 'success');
        Storage.save();
    }
};

// ------------------------------------------
// APP CONTROLLER
// ------------------------------------------
const App = {
    views: ['home', 'lobby', 'wallet', 'rewards', 'achievements', 'leaderboard', 'history', 'profile', 'statistics', 'slot', 'dice', 'coin', 'roulette', 'blackjack', 'lucky', 'gem', 'crash'],
    init: function() {
        Storage.load();
        this.applyTheme(Storage.data.theme);
        Wallet.updateUI();
        Profile.updateUI();
        Lobby.render();
        Achievements.render();
        
        // Listeners
        document.addEventListener('click', () => AudioSys.init(), {once: true}); // Init audio on first interaction
    },
    navigate: function(viewId) {
        AudioSys.click();
        this.views.forEach(v => {
            const el = document.getElementById('view-' + v) || document.getElementById('game-' + v);
            if (el) {
                if (v === viewId) {
                    el.classList.remove('hidden');
                    el.classList.add('active');
                } else {
                    el.classList.add('hidden');
                    el.classList.remove('active');
                }
            }
        });
        document.getElementById('mobile-menu').classList.add('hidden');
        window.scrollTo(0,0);
        
        if(viewId === 'history') HistoryView.render();
        if(viewId === 'statistics') StatsView.render();
        if(viewId === 'leaderboard') Leaderboard.render();
        if(viewId === 'rewards') Rewards.render();
    },
    toggleMobileMenu: function() {
        document.getElementById('mobile-menu').classList.toggle('hidden');
    },
    changeTheme: function(theme) {
        Storage.data.theme = theme;
        this.applyTheme(theme);
        Storage.save();
    },
    applyTheme: function(theme) {
        document.body.className = `theme-${theme}`;
        document.getElementById('setting-theme').value = theme;
    },
    toggleSound: function(enabled) {
        Storage.data.soundEnabled = enabled;
        Storage.save();
    },
    toggleAnimations: function(enabled) {
        Storage.data.animEnabled = enabled;
        if(!enabled) document.body.style.setProperty('*', 'animation: none !important; transition: none !important;');
        Storage.save();
    },
    showRules: function(gameName) {
        document.getElementById('rules-title').textContent = gameName + " Rules";
        const content = RulesData[gameName] || "No rules defined.";
        document.getElementById('rules-content').innerHTML = content;
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('rules-modal').classList.remove('hidden');
        document.getElementById('confirm-modal').classList.add('hidden');
    },
    confirmAction: function(title, text, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-content').textContent = text;
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('rules-modal').classList.add('hidden');
        
        const btn = document.getElementById('confirm-btn');
        btn.onclick = () => {
            callback();
            this.closeModal();
        };
    },
    closeModal: function() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },
    resetAccount: function() {
        Storage.reset();
        this.init();
        Notifications.show('Demo account reset successfully.', 'success');
        this.navigate('home');
    }
};

// ------------------------------------------
// LOBBY & SEARCH
// ------------------------------------------
const GamesList = [
    { id: 'slot', name: 'Slot Machine', icon: '🎰', desc: 'Spin the reels and match symbols.', diff: 'Easy', max: '10x' },
    { id: 'dice', name: 'Dice Rush', icon: '🎲', desc: 'Predict the outcome of a virtual roll.', diff: 'Easy', max: '50x' },
    { id: 'coin', name: 'Coin Flip', icon: '🪙', desc: 'Choose heads or tails.', diff: 'Easy', max: '2x' },
    { id: 'roulette', name: 'Roulette', icon: '🎡', desc: 'Choose a number, color, or category.', diff: 'Medium', max: '36x' },
    { id: 'blackjack', name: 'Blackjack', icon: '🃏', desc: 'Beat the dealer without going over 21.', diff: 'Hard', max: '2.5x' },
    { id: 'lucky', name: 'Lucky Number', icon: '🎯', desc: 'Guess the secret number.', diff: 'Varies', max: '10x' },
    { id: 'gem', name: 'Gem Match', icon: '💎', desc: 'Match gems to earn virtual coins.', diff: 'Medium', max: '5x' },
    { id: 'crash', name: 'Crash Demo', icon: '🧱', desc: 'Fictional visual multiplier game.', diff: 'Extreme', max: '100x+' }
];

const Lobby = {
    render: function() {
        const container = document.getElementById('games-container');
        const favContainer = document.getElementById('favorites-container');
        container.innerHTML = '';
        favContainer.innerHTML = '';
        
        GamesList.forEach(game => {
            const isFav = Storage.data.favorites.includes(game.id);
            const card = `
                <div class="game-card" data-name="${game.name.toLowerCase()}">
                    <div class="fav-btn ${isFav ? 'active' : ''}" onclick="Lobby.toggleFav('${game.id}', event)">❤️</div>
                    <div class="game-icon">${game.icon}</div>
                    <h3>${game.name}</h3>
                    <p class="game-desc">${game.desc}</p>
                    <div class="game-stats-row">
                        <span>Diff: ${game.diff}</span>
                        <span>Max Win: ${game.max}</span>
                    </div>
                    <button class="btn-play" onclick="App.navigate('${game.id}')">Play Now</button>
                </div>
            `;
            container.innerHTML += card;
            if (isFav) favContainer.innerHTML += card;
        });
        
        if (Storage.data.favorites.length === 0) {
            favContainer.innerHTML = "<p class='text-muted'>No favorite games yet. Click the heart on a game to add it!</p>";
        }
    },
    toggleFav: function(id, e) {
        e.stopPropagation();
        const index = Storage.data.favorites.indexOf(id);
        if (index > -1) Storage.data.favorites.splice(index, 1);
        else Storage.data.favorites.push(id);
        Storage.save();
        this.render();
    }
};

App.filterGames = function() {
    const term = document.getElementById('game-search').value.toLowerCase();
    document.querySelectorAll('#games-container .game-card').forEach(card => {
        if (card.dataset.name.includes(term)) card.style.display = 'block';
        else card.style.display = 'none';
    });
};

// ------------------------------------------
// PROFILE & SETTINGS
// ------------------------------------------
const Profile = {
    updateUI: function() {
        document.getElementById('nav-avatar').textContent = Storage.data.avatar;
        document.getElementById('profile-avatar').textContent = Storage.data.avatar;
        document.getElementById('profile-username').textContent = Storage.data.username;
        document.getElementById('profile-join-date').textContent = Storage.data.joinDate;
        
        document.getElementById('edit-username').value = Storage.data.username;
        document.getElementById('edit-avatar').value = Storage.data.avatar;
        
        document.getElementById('setting-theme').value = Storage.data.theme;
        document.getElementById('setting-sound').checked = Storage.data.soundEnabled;
        document.getElementById('setting-anim').checked = Storage.data.animEnabled;
    },
    save: function() {
        const name = document.getElementById('edit-username').value || 'Player';
        const avatar = document.getElementById('edit-avatar').value || '👤';
        Storage.data.username = name;
        Storage.data.avatar = avatar;
        Storage.save();
        this.updateUI();
        Notifications.show('Profile updated successfully!', 'success');
    }
};

// ------------------------------------------
// VIEWS (History, Stats, Leaderboard, Rewards)
// ------------------------------------------
const HistoryView = {
    render: function() {
        const tbody = document.getElementById('history-body');
        const filter = document.getElementById('history-filter').value;
        tbody.innerHTML = '';
        
        const data = Storage.data.history.filter(h => {
            if(filter === 'all') return true;
            if(filter === 'win') return h.result === 'win';
            if(filter === 'loss') return h.result === 'loss';
            return h.game === filter;
        });
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No history found.</td></tr>';
            return;
        }
        
        data.forEach(h => {
            const color = h.result === 'win' ? 'text-green' : h.result === 'loss' ? 'text-red' : '';
            const sign = h.profit > 0 ? '+' : '';
            tbody.innerHTML += `
                <tr>
                    <td>${h.game}</td>
                    <td>🪙 ${h.bet}</td>
                    <td>${h.result.toUpperCase()}</td>
                    <td class="${color}">${sign}${h.profit}</td>
                    <td>${h.date}</td>
                    <td>${h.time}</td>
                </tr>
            `;
        });
    },
    clear: function() {
        Storage.data.history = [];
        Storage.save();
        this.render();
        Notifications.show('History cleared.', 'info');
    }
};

const StatsView = {
    render: function() {
        const s = Storage.data.stats;
        document.getElementById('stat-total-games').textContent = s.totalGames;
        document.getElementById('stat-total-wins').textContent = s.totalWins;
        document.getElementById('stat-total-losses').textContent = s.totalLosses;
        const winRate = s.totalGames > 0 ? ((s.totalWins/s.totalGames)*100).toFixed(1) : 0;
        document.getElementById('stat-win-pct').textContent = winRate + '%';
        document.getElementById('stat-won').textContent = s.totalWon.toLocaleString();
        document.getElementById('stat-lost').textContent = s.totalLost.toLocaleString();
        document.getElementById('stat-streak').textContent = s.streak;
        document.getElementById('stat-best-streak').textContent = s.bestStreak;
        
        // Favorite game
        let fav = '-', max = 0;
        for (const [game, count] of Object.entries(s.gameCounts)) {
            if (count > max) { max = count; fav = game; }
        }
        document.getElementById('stat-fav-game').textContent = fav;
        
        // Chart
        const winBar = document.getElementById('chart-win');
        const lossBar = document.getElementById('chart-loss');
        if (s.totalGames === 0) {
            winBar.style.width = '50%'; winBar.textContent = 'Wins: 0%';
            lossBar.style.width = '50%'; lossBar.textContent = 'Losses: 0%';
        } else {
            const wp = (s.totalWins/s.totalGames)*100;
            const lp = 100 - wp;
            winBar.style.width = wp + '%'; winBar.textContent = 'Wins: ' + wp.toFixed(0) + '%';
            lossBar.style.width = lp + '%'; lossBar.textContent = 'Losses: ' + lp.toFixed(0) + '%';
        }
    }
};

const Leaderboard = {
    render: function() {
        const tbody = document.getElementById('leaderboard-body');
        // Fictional data + current user
        let players = [
            { name: 'NovaPlayer', coins: 154000, games: 1200, wins: 640 },
            { name: 'ShadowX', coins: 89000, games: 800, wins: 410 },
            { name: 'LuckyFox', coins: 45000, games: 500, wins: 230 },
            { name: 'CyberKing', coins: 21000, games: 300, wins: 140 },
            { name: 'StarGamer', coins: 5000, games: 100, wins: 40 },
            { name: Storage.data.username + ' (You)', coins: Storage.data.balance, games: Storage.data.stats.totalGames, wins: Storage.data.stats.totalWins, isUser: true }
        ];
        
        players.sort((a,b) => b.coins - a.coins); // Sort by coins
        
        tbody.innerHTML = '';
        players.forEach((p, index) => {
            let rank = index + 1;
            if (rank === 1) rank = '🥇 1';
            else if (rank === 2) rank = '🥈 2';
            else if (rank === 3) rank = '🥉 3';
            
            const winRate = p.games > 0 ? ((p.wins/p.games)*100).toFixed(1) + '%' : '0%';
            
            tbody.innerHTML += `
                <tr style="${p.isUser ? 'background: rgba(214,51,255,0.2)' : ''}">
                    <td>${rank}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>🪙 ${p.coins.toLocaleString()}</td>
                    <td>${p.games}</td>
                    <td>${p.wins}</td>
                    <td>${winRate}</td>
                </tr>
            `;
        });
    }
};

const Rewards = {
    calendar: [500, 750, 1000, 1500, 2000, 3000, 5000],
    render: function() {
        const cont = document.getElementById('rewards-calendar');
        cont.innerHTML = '';
        const day = Storage.data.lastRewardDay % 7;
        
        this.calendar.forEach((amt, i) => {
            const isToday = i === day;
            const isClaimed = i < day;
            cont.innerHTML += `
                <div class="reward-day ${isToday ? 'active' : ''} ${isClaimed ? 'claimed' : ''}">
                    <h3>Day ${i+1}</h3>
                    <p>🪙 ${amt}</p>
                </div>
            `;
        });
        
        this.updateTimer();
    },
    updateTimer: function() {
        const last = Storage.data.lastRewardTime;
        const now = Date.now();
        const cooldown = 86400000; // 24 hours
        
        if (!last || now - last > cooldown) {
            document.getElementById('reward-status').textContent = 'Reward Available Now!';
            document.getElementById('btn-claim-daily').disabled = false;
        } else {
            const left = cooldown - (now - last);
            const h = Math.floor(left / 3600000);
            const m = Math.floor((left % 3600000) / 60000);
            document.getElementById('reward-status').textContent = `Next reward in: ${h}h ${m}m`;
            document.getElementById('btn-claim-daily').disabled = true;
        }
    },
    claimDaily: function() {
        const last = Storage.data.lastRewardTime;
        const now = Date.now();
        const cooldown = 86400000;
        
        if (last && now - last < cooldown) return;
        
        const day = Storage.data.lastRewardDay % 7;
        const amt = this.calendar[day];
        
        Wallet.add(amt);
        Storage.data.lastRewardDay++;
        Storage.data.lastRewardTime = now;
        Storage.save();
        Notifications.show(`Claimed Daily Reward: ${amt} coins!`, 'success');
        this.render();
    }
};

const AchievementsList = [
    { id: 'first_win', title: 'First Win', desc: 'Win your first game.', check: (s) => s.totalWins >= 1 },
    { id: 'streak_5', title: 'Winning Streak', desc: 'Win 5 games in a row.', check: (s) => s.bestStreak >= 5 },
    { id: 'high_roller', title: 'High Roller', desc: 'Win 5,000+ in a single game.', check: (s) => s.bestWin >= 5000 },
    { id: 'slot_master', title: 'Slot Master', desc: 'Play 50 slot games.', check: (s) => (s.gameCounts['Slot Machine'] || 0) >= 50 },
    { id: 'blackjack_pro', title: 'Blackjack Pro', desc: 'Play 10 Blackjack games.', check: (s) => (s.gameCounts['Blackjack'] || 0) >= 10 },
    { id: 'millionaire', title: 'Wealthy', desc: 'Reach 100,000 virtual coins.', check: (s, b) => b >= 100000 }
];

const Achievements = {
    render: function() {
        const cont = document.getElementById('achievements-container');
        cont.innerHTML = '';
        AchievementsList.forEach(a => {
            const unlocked = Storage.data.achievements.includes(a.id);
            cont.innerHTML += `
                <div class="ach-card ${unlocked ? 'unlocked' : ''}">
                    <div class="ach-icon">${unlocked ? '🏆' : '🔒'}</div>
                    <div class="ach-info">
                        <h4>${a.title}</h4>
                        <p>${a.desc}</p>
                    </div>
                </div>
            `;
        });
    },
    check: function() {
        const s = Storage.data.stats;
        const b = Storage.data.balance;
        let newUnlock = false;
        
        AchievementsList.forEach(a => {
            if (!Storage.data.achievements.includes(a.id)) {
                if (a.check(s, b)) {
                    Storage.data.achievements.push(a.id);
                    Notifications.show(`Achievement Unlocked: ${a.title}!`, 'success');
                    newUnlock = true;
                }
            }
        });
        
        if (newUnlock) {
            Storage.save();
            this.render();
        }
    }
};


// ==========================================
// GAME ENGINES
// ==========================================
const Games = {};

// --- Slot Machine ---
Games.slot = {
    symbols: ['🍒','🍋','🍊','⭐','💎','7️⃣','🔔'],
    spin: function() {
        const bet = parseInt(document.getElementById('slot-bet').value);
        if (!Wallet.validateBet(bet)) return;
        
        Wallet.deduct(bet);
        const r1 = document.getElementById('reel1');
        const r2 = document.getElementById('reel2');
        const r3 = document.getElementById('reel3');
        const res = document.getElementById('slot-result');
        const btn = document.getElementById('btn-spin-slot');
        
        btn.disabled = true;
        res.textContent = "Spinning...";
        res.className = "game-result";
        
        if(Storage.data.animEnabled) {
            r1.classList.add('spinning');
            r2.classList.add('spinning');
            r3.classList.add('spinning');
        }
        
        AudioSys.spin();

        setTimeout(() => {
            r1.classList.remove('spinning');
            r2.classList.remove('spinning');
            r3.classList.remove('spinning');
            
            const s1 = this.symbols[Math.floor(Math.random() * this.symbols.length)];
            const s2 = this.symbols[Math.floor(Math.random() * this.symbols.length)];
            const s3 = this.symbols[Math.floor(Math.random() * this.symbols.length)];
            
            r1.textContent = s1;
            r2.textContent = s2;
            r3.textContent = s3;
            
            let multi = 0;
            if (s1 === s2 && s2 === s3) {
                if (s1 === '7️⃣') multi = 10;
                else if (s1 === '💎') multi = 7;
                else if (s1 === '⭐') multi = 5;
                else multi = 3;
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                multi = 1.5;
            }
            
            let win = Math.floor(bet * multi);
            
            if (win > 0) {
                Wallet.add(win);
                res.innerHTML = `🎉 You won ${win} coins! (${multi}x)`;
                res.classList.add('win-anim');
                Wallet.recordGame('Slot Machine', bet, 'win', win - bet);
                AudioSys.win();
            } else {
                res.innerHTML = `No match. You lost ${bet}.`;
                res.classList.add('loss-anim');
                Wallet.recordGame('Slot Machine', bet, 'loss', -bet);
                AudioSys.lose();
            }
            btn.disabled = false;
        }, 1500);
    }
};

// --- Dice Rush ---
Games.dice = {
    roll: function(type) {
        const bet = parseInt(document.getElementById('dice-bet').value);
        if (!Wallet.validateBet(bet)) return;
        
        Wallet.deduct(bet);
        const display = document.getElementById('dice-result');
        const msg = document.getElementById('dice-msg');
        
        msg.textContent = "Rolling...";
        msg.className = "game-result";
        if(Storage.data.animEnabled) display.classList.add('rolling');
        AudioSys.spin();
        
        setTimeout(() => {
            display.classList.remove('rolling');
            const result = Math.floor(Math.random() * 100) + 1;
            display.textContent = result;
            
            let won = false;
            let multi = 0;
            
            if (type === 'under' && result < 50) { won = true; multi = 2; }
            else if (type === 'over' && result > 50) { won = true; multi = 2; }
            else if (type === 'exact' && result === 50) { won = true; multi = 50; }
            
            if (won) {
                let winAmt = bet * multi;
                Wallet.add(winAmt);
                msg.innerHTML = `🎉 You won ${winAmt} coins!`;
                msg.classList.add('win-anim');
                Wallet.recordGame('Dice Rush', bet, 'win', winAmt - bet);
                AudioSys.win();
            } else {
                msg.innerHTML = `You lost ${bet} coins.`;
                msg.classList.add('loss-anim');
                Wallet.recordGame('Dice Rush', bet, 'loss', -bet);
                AudioSys.lose();
            }
        }, 1000);
    }
};

// --- Coin Flip ---
Games.coin = {
    flip: function(guess) {
        const bet = parseInt(document.getElementById('coin-bet').value);
        if (!Wallet.validateBet(bet)) return;
        
        Wallet.deduct(bet);
        const coin = document.getElementById('coin-visual');
        const msg = document.getElementById('coin-msg');
        
        msg.textContent = "Flipping...";
        msg.className = "game-result";
        
        // Remove animation to re-trigger
        coin.style.animation = 'none';
        void coin.offsetWidth; // trigger reflow
        
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const finalRot = result === 'heads' ? 0 : 180;
        
        if (Storage.data.animEnabled) {
            coin.style.animation = 'flipCoin 2s ease-out';
        }
        
        AudioSys.spin();
        
        setTimeout(() => {
            coin.style.transform = `rotateY(${finalRot}deg)`;
            
            if (guess === result) {
                let winAmt = bet * 2;
                Wallet.add(winAmt);
                msg.innerHTML = `🎉 It's ${result.toUpperCase()}! You won ${winAmt} coins.`;
                msg.classList.add('win-anim');
                Wallet.recordGame('Coin Flip', bet, 'win', winAmt - bet);
                AudioSys.win();
            } else {
                msg.innerHTML = `It's ${result.toUpperCase()}. You lost ${bet} coins.`;
                msg.classList.add('loss-anim');
                Wallet.recordGame('Coin Flip', bet, 'loss', -bet);
                AudioSys.lose();
            }
        }, Storage.data.animEnabled ? 2000 : 100);
    }
};

// --- Roulette ---
Games.roulette = {
    spin: function() {
        const bet = parseInt(document.getElementById('roulette-bet').value);
        if (!Wallet.validateBet(bet)) return;
        
        const type = document.getElementById('roulette-bet-type').value;
        Wallet.deduct(bet);
        
        const wheel = document.getElementById('roulette-wheel-visual');
        const resNum = document.getElementById('roulette-result-number');
        const msg = document.getElementById('roulette-msg');
        
        msg.textContent = "Spinning...";
        msg.className = "game-result";
        resNum.textContent = "?";
        
        const deg = Math.floor(Math.random() * 360) + 1080; // spin multiple times
        if(Storage.data.animEnabled) wheel.style.transform = `rotate(${deg}deg)`;
        AudioSys.spin();
        
        setTimeout(() => {
            const result = Math.floor(Math.random() * 37); // 0-36
            resNum.textContent = result;
            
            const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(result);
            const isBlack = result !== 0 && !isRed;
            const isEven = result !== 0 && result % 2 === 0;
            const isOdd = result !== 0 && result % 2 !== 0;
            const isLow = result >= 1 && result <= 18;
            const isHigh = result >= 19 && result <= 36;
            
            let won = false;
            let multi = 0;
            
            if (type === 'red' && isRed) { won = true; multi = 2; }
            else if (type === 'black' && isBlack) { won = true; multi = 2; }
            else if (type === 'even' && isEven) { won = true; multi = 2; }
            else if (type === 'odd' && isOdd) { won = true; multi = 2; }
            else if (type === 'low' && isLow) { won = true; multi = 2; }
            else if (type === 'high' && isHigh) { won = true; multi = 2; }
            
            if (won) {
                let winAmt = bet * multi;
                Wallet.add(winAmt);
                msg.innerHTML = `🎉 Number ${result}! You won ${winAmt}.`;
                msg.classList.add('win-anim');
                Wallet.recordGame('Roulette', bet, 'win', winAmt - bet);
                AudioSys.win();
            } else {
                msg.innerHTML = `Number ${result}. You lost ${bet}.`;
                msg.classList.add('loss-anim');
                Wallet.recordGame('Roulette', bet, 'loss', -bet);
                AudioSys.lose();
            }
            
            // reset rotation for next spin
            if(Storage.data.animEnabled) {
                setTimeout(() => {
                    wheel.style.transition = 'none';
                    wheel.style.transform = `rotate(${deg % 360}deg)`;
                    setTimeout(() => wheel.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)', 50);
                }, 1000);
            }
        }, Storage.data.animEnabled ? 3000 : 100);
    }
};

// --- Blackjack ---
Games.blackjack = {
    deck: [],
    pCards: [],
    dCards: [],
    betAmt: 0,
    
    getDeck: function() {
        const suits = ['♠','♥','♦','♣'];
        const vals = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        let d = [];
        for(let s of suits) {
            for(let v of vals) {
                let weight = parseInt(v);
                if (['J','Q','K'].includes(v)) weight = 10;
                if (v === 'A') weight = 11;
                d.push({v: v, s: s, w: weight, color: (s==='♥'||s==='♦') ? 'red' : 'black'});
            }
        }
        return d.sort(() => Math.random() - 0.5);
    },
    score: function(cards) {
        let sc = 0;
        let aces = 0;
        cards.forEach(c => { sc += c.w; if(c.v === 'A') aces++; });
        while (sc > 21 && aces > 0) { sc -= 10; aces--; }
        return sc;
    },
    renderCards: function(elId, cards, hideSecond = false) {
        const el = document.getElementById(elId);
        el.innerHTML = '';
        cards.forEach((c, i) => {
            if (hideSecond && i === 1) {
                el.innerHTML += `<div class="card card-hidden">?</div>`;
            } else {
                el.innerHTML += `<div class="card ${c.color}"><span>${c.v}</span><span style="font-size:2rem;text-align:center">${c.s}</span><span>${c.v}</span></div>`;
            }
        });
    },
    deal: function() {
        const bet = parseInt(document.getElementById('bj-bet').value);
        if (!Wallet.validateBet(bet)) return;
        
        Wallet.deduct(bet);
        this.betAmt = bet;
        this.deck = this.getDeck();
        this.pCards = [this.deck.pop(), this.deck.pop()];
        this.dCards = [this.deck.pop(), this.deck.pop()];
        
        document.getElementById('bj-btn-deal').classList.add('hidden');
        document.getElementById('bj-actions').classList.remove('hidden');
        document.getElementById('bj-msg').textContent = "Hit or Stand?";
        document.getElementById('bj-msg').className = "game-result";
        
        this.updateUI(true);
        AudioSys.spin();
        
        if (this.score(this.pCards) === 21) this.end('blackjack');
    },
    hit: function() {
        this.pCards.push(this.deck.pop());
        this.updateUI(true);
        AudioSys.click();
        if (this.score(this.pCards) > 21) this.end('bust');
    },
    stand: function() {
        document.getElementById('bj-actions').classList.add('hidden');
        this.updateUI(false); // Reveal dealer card
        
        // Dealer AI
        const playDealer = () => {
            if (this.score(this.dCards) < 17) {
                this.dCards.push(this.deck.pop());
                this.updateUI(false);
                setTimeout(playDealer, 500);
            } else {
                this.checkWin();
            }
        };
        setTimeout(playDealer, 500);
    },
    updateUI: function(hideDealer) {
        this.renderCards('bj-player-cards', this.pCards);
        this.renderCards('bj-dealer-cards', this.dCards, hideDealer);
        document.getElementById('bj-player-score').textContent = this.score(this.pCards);
        document.getElementById('bj-dealer-score').textContent = hideDealer ? '?' : this.score(this.dCards);
    },
    checkWin: function() {
        const ps = this.score(this.pCards);
        const ds = this.score(this.dCards);
        if (ds > 21) this.end('dealer_bust');
        else if (ps > ds) this.end('win');
        else if (ds > ps) this.end('lose');
        else this.end('push');
    },
    end: function(reason) {
        document.getElementById('bj-actions').classList.add('hidden');
        document.getElementById('bj-btn-deal').classList.remove('hidden');
        const msg = document.getElementById('bj-msg');
        this.updateUI(false);
        
        if (reason === 'blackjack') {
            let w = this.betAmt * 2.5;
            Wallet.add(w);
            msg.innerHTML = `🎉 BLACKJACK! Won ${w}`;
            msg.classList.add('win-anim');
            Wallet.recordGame('Blackjack', this.betAmt, 'win', w - this.betAmt);
            AudioSys.win();
        } else if (reason === 'bust') {
            msg.innerHTML = `Bust! You lost ${this.betAmt}`;
            msg.classList.add('loss-anim');
            Wallet.recordGame('Blackjack', this.betAmt, 'loss', -this.betAmt);
            AudioSys.lose();
        } else if (reason === 'dealer_bust' || reason === 'win') {
            let w = this.betAmt * 2;
            Wallet.add(w);
            msg.innerHTML = `🎉 You won ${w}!`;
            msg.classList.add('win-anim');
            Wallet.recordGame('Blackjack', this.betAmt, 'win', w - this.betAmt);
            AudioSys.win();
        } else if (reason === 'lose') {
            msg.innerHTML = `Dealer wins. Lost ${this.betAmt}`;
            msg.classList.add('loss-anim');
            Wallet.recordGame('Blackjack', this.betAmt, 'loss', -this.betAmt);
            AudioSys.lose();
        } else {
            Wallet.add(this.betAmt); // return bet
            msg.innerHTML = `Push. Bet returned.`;
            Wallet.recordGame('Blackjack', this.betAmt, 'tie', 0);
        }
    }
};

// --- Lucky Number ---
Games.lucky = {
    secret: 0,
    attempts: 5,
    maxNum: 20,
    betAmt: 0,
    setDifficulty: function(diff) {
        document.querySelectorAll('.lucky-difficulty button').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        if (diff === 'easy') { this.maxNum = 20; this.attempts = 5; }
        if (diff === 'medium') { this.maxNum = 50; this.attempts = 7; }
        if (diff === 'hard') { this.maxNum = 100; this.attempts = 10; }
        document.getElementById('lucky-msg').textContent = `Guess between 1 and ${this.maxNum}.`;
    },
    start: function() {
        const bet = parseInt(document.getElementById('lucky-bet').value);
        if (!Wallet.validateBet(bet)) return;
        Wallet.deduct(bet);
        this.betAmt = bet;
        this.secret = Math.floor(Math.random() * this.maxNum) + 1;
        
        // Reset attempts based on diff
        if(this.maxNum === 20) this.attempts = 5;
        if(this.maxNum === 50) this.attempts = 7;
        if(this.maxNum === 100) this.attempts = 10;
        
        document.getElementById('lucky-btn-start').classList.add('hidden');
        document.getElementById('lucky-play-area').classList.remove('hidden');
        document.getElementById('lucky-attempts').textContent = this.attempts;
        document.getElementById('lucky-msg').textContent = "Game started! Make a guess.";
        document.getElementById('lucky-msg').className = "game-result";
    },
    guess: function() {
        const g = parseInt(document.getElementById('lucky-guess').value);
        if (isNaN(g)) return;
        
        this.attempts--;
        document.getElementById('lucky-attempts').textContent = this.attempts;
        const msg = document.getElementById('lucky-msg');
        
        if (g === this.secret) {
            let multi = this.maxNum === 20 ? 2 : this.maxNum === 50 ? 5 : 10;
            let win = this.betAmt * multi;
            Wallet.add(win);
            msg.innerHTML = `🎉 Correct! You won ${win} coins.`;
            msg.classList.add('win-anim');
            Wallet.recordGame('Lucky Number', this.betAmt, 'win', win - this.betAmt);
            this.end();
            AudioSys.win();
        } else if (this.attempts === 0) {
            msg.innerHTML = `Out of attempts! Secret was ${this.secret}.`;
            msg.classList.add('loss-anim');
            Wallet.recordGame('Lucky Number', this.betAmt, 'loss', -this.betAmt);
            this.end();
            AudioSys.lose();
        } else if (g < this.secret) {
            msg.textContent = "Too low! Try again.";
            AudioSys.click();
        } else {
            msg.textContent = "Too high! Try again.";
            AudioSys.click();
        }
    },
    end: function() {
        document.getElementById('lucky-btn-start').classList.remove('hidden');
        document.getElementById('lucky-play-area').classList.add('hidden');
        document.getElementById('lucky-guess').value = '';
    }
};

// --- Gem Match ---
Games.gem = {
    betAmt: 0,
    gemsFound: 0,
    clicks: 0,
    gridSize: 16,
    start: function() {
        const bet = parseInt(document.getElementById('gem-bet').value);
        if (!Wallet.validateBet(bet)) return;
        Wallet.deduct(bet);
        this.betAmt = bet;
        this.gemsFound = 0;
        this.clicks = 0;
        
        const grid = document.getElementById('gem-grid');
        grid.innerHTML = '';
        
        // Hide 3 gems in 16 slots
        let arr = Array(this.gridSize).fill('empty');
        arr[0] = arr[1] = arr[2] = 'gem';
        arr.sort(() => Math.random() - 0.5);
        
        arr.forEach((type, i) => {
            grid.innerHTML += `<div class="gem-cell" id="gem-${i}" onclick="games.gem.click(${i}, '${type}')">?</div>`;
        });
        
        document.getElementById('gem-btn-start').disabled = true;
        document.getElementById('gem-msg').textContent = "Find 3 gems! You have 5 tries.";
        document.getElementById('gem-msg').className = "game-result";
    },
    click: function(idx, type) {
        const cell = document.getElementById(`gem-${idx}`);
        if (cell.classList.contains('revealed')) return;
        
        this.clicks++;
        cell.classList.add('revealed');
        
        if (type === 'gem') {
            cell.textContent = '💎';
            this.gemsFound++;
            AudioSys.click();
        } else {
            cell.textContent = '❌';
            AudioSys.click();
        }
        
        const msg = document.getElementById('gem-msg');
        
        if (this.gemsFound === 3) {
            let win = this.betAmt * 5;
            Wallet.add(win);
            msg.innerHTML = `🎉 You found all gems! Won ${win}.`;
            msg.classList.add('win-anim');
            Wallet.recordGame('Gem Match', this.betAmt, 'win', win - this.betAmt);
            this.end();
            AudioSys.win();
        } else if (this.clicks === 5) {
            msg.innerHTML = `Out of tries! You lost ${this.betAmt}.`;
            msg.classList.add('loss-anim');
            Wallet.recordGame('Gem Match', this.betAmt, 'loss', -this.betAmt);
            this.end();
            AudioSys.lose();
        } else {
            msg.textContent = `Found: ${this.gemsFound}/3 | Tries left: ${5 - this.clicks}`;
        }
    },
    end: function() {
        document.getElementById('gem-btn-start').disabled = false;
        // Reveal all
        document.querySelectorAll('.gem-cell').forEach(c => c.classList.add('revealed'));
    }
};

// --- Crash Demo ---
Games.crash = {
    betAmt: 0,
    multi: 1.00,
    timer: null,
    running: false,
    start: function() {
        const bet = parseInt(document.getElementById('crash-bet').value);
        if (!Wallet.validateBet(bet)) return;
        Wallet.deduct(bet);
        this.betAmt = bet;
        this.multi = 1.00;
        this.running = true;
        
        document.getElementById('crash-btn-start').classList.add('hidden');
        document.getElementById('crash-btn-collect').classList.remove('hidden');
        const display = document.getElementById('crash-multiplier');
        display.classList.remove('crashed');
        document.getElementById('crash-msg').textContent = "Multiplier increasing...";
        document.getElementById('crash-msg').className = "game-result";
        
        // Determine crash point upfront
        // Highly skewed towards low numbers for realism
        let crashPoint = (Math.random() < 0.1) ? 1.00 : 1 + (Math.random() * 4);
        if (Math.random() < 0.05) crashPoint += Math.random() * 10; // Rare high crash
        
        this.timer = setInterval(() => {
            this.multi += 0.01 + (this.multi * 0.005); // Accelerate
            display.textContent = this.multi.toFixed(2) + 'x';
            
            if (this.multi >= crashPoint) {
                this.crashOut();
            }
        }, 50);
    },
    collect: function() {
        if (!this.running) return;
        clearInterval(this.timer);
        this.running = false;
        let win = Math.floor(this.betAmt * this.multi);
        Wallet.add(win);
        document.getElementById('crash-msg').innerHTML = `🎉 Collected at ${this.multi.toFixed(2)}x! Won ${win}.`;
        document.getElementById('crash-msg').classList.add('win-anim');
        Wallet.recordGame('Crash Demo', this.betAmt, 'win', win - this.betAmt);
        this.end();
        AudioSys.win();
    },
    crashOut: function() {
        clearInterval(this.timer);
        this.running = false;
        const display = document.getElementById('crash-multiplier');
        display.classList.add('crashed');
        display.textContent = "CRASHED @ " + this.multi.toFixed(2) + "x";
        
        document.getElementById('crash-msg').innerHTML = `Crashed! You lost ${this.betAmt}.`;
        document.getElementById('crash-msg').classList.add('loss-anim');
        Wallet.recordGame('Crash Demo', this.betAmt, 'loss', -this.betAmt);
        this.end();
        AudioSys.lose();
    },
    end: function() {
        document.getElementById('crash-btn-start').classList.remove('hidden');
        document.getElementById('crash-btn-collect').classList.add('hidden');
    }
};

const RulesData = {
    'Slot Machine': 'Match 3 symbols to win big! <br> 7️⃣ = 10x <br> 💎 = 7x <br> ⭐ = 5x <br> Any 3 = 3x <br> Any 2 = 1.5x.',
    'Dice Rush': 'Guess if the random number (1-100) will be Under 50, Over 50, or exactly 50.',
    'Coin Flip': 'A classic 50/50 game. Guess Heads or Tails. Pays 2x.',
    'Roulette': 'Choose Red/Black, Even/Odd, or High/Low. Wheel spins and a random number 0-36 is chosen.',
    'Blackjack': 'Get closer to 21 than the dealer without going over (busting). Face cards are 10, Ace is 11 or 1. Dealer hits until 17.',
    'Lucky Number': 'Guess the secret number within the given attempts. The game will tell you if you are too high or too low.',
    'Gem Match': 'There are 3 gems hidden in the 16 squares. Find all 3 within 5 clicks to win 5x your bet!',
    'Crash Demo': 'The multiplier constantly increases. Click Collect before it crashes! If it crashes before you collect, you lose your bet.'
};

// Global expose for HTML onclick handlers
window.app = App;
window.wallet = Wallet;
window.games = Games;
window.profile = Profile;
window.historyView = HistoryView;
window.rewards = Rewards;

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
