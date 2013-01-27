YUI().use("app", "handlebars", function(Y) {
	var getTemplate = function(templateId) {
			return Y.Handlebars.compile(Y.one(templateId).getContent());
		},
		getRandomCard = function() {
			return CARDS[parseInt(CARDS.length * Math.random(), 10)];
		};
	
	Y.MainView = Y.Base.create('MainView', Y.View, [], {
		templateFn: getTemplate('#gameboard-tmpl'),
		events: {
			"input.tappoo-team-name": {
				'change': "_onTeamNameChange"
			},
			"#tappoo-startgame": {
				'click': '_onDOMStartGame'
			}
		},
		render: function() {
			Y.log("Rendering MainView");
			var info = this.getAttrs();
			Y.log(info);
			this.get('container').setContent(this.templateFn(info));
		},
		_onTeamNameChange: function(e) {
			var id = e.target.ancestor('[data-id-team]').getAttribute("data-id-team"),
				newVal = e.target.get('value');
			this.fire('teamNameChange', {
					id_team: id,
					newVal: newVal
				});
		},
		_onDOMStartGame: function(e) {
			this.fire('startGame');
		}
	});
	
	Y.RoundView = Y.Base.create('RoundView', Y.View, [], {
		templateFn: getTemplate('#round-tmpl'),
		render: function() {
			Y.log("Rendering RoundView");
			var info = this.get('detail');
			Y.log(info);
			this.get('container').setContent(this.templateFn(info));
		},
		events: {
			'#tappoo-startround': {
				'click': 'begin'
			},
			'#tappoo-pass': {
				'click': 'pass'
			},
			'#tappoo-done': {
				'click': 'done'
			},
			'#tappoo-gonext': {
				'click': 'finish'
			}
		},
		showDeck: function(w) {
			var cnt = this.get('container');
			Y.Array.each(['pre','post','act'], function(ww) {
				var node = cnt.one('.tappoo-round-'+ww);
				if (node) {
					node.setStyle('display', (ww == w) ? 'block' : 'none');
				} else {
					Y.log('Attenzione, nodo "' + '.tappoo-round-'+ ww + '"');
				}
			});
		},
		showNextCard: function() {
			var card = getRandomCard(),
				cnt = this.get('container');
			Y.log('getting a card');
			Y.log(card);
			cnt.one('.tappoo-toguess').setContent(card.toGuess);
			cnt.one('.tappoo-toavoid').setContent(Y.Array.map(card.toAvoid, function(w) {
					return "<li>" + w + "</li>";
				}).join(''));
			this.card = card.toGuess;
		},
		pass: function() {
			this._result(-1);
		},
		done: function() {
			this._result(1);
		},
		_result: function(score) {
			var d = this.get('detail');
			this.results.push({
					'id_team': d.team.id_team,
					'word': this.card,
					'score': score
				});
			this.showNextCard();
			Y.log('Updating results');
			Y.log(this.results);
		},
		begin: function() {
			var s = 0, t, detail = this.get('detail'),
				cnt = this.get('container'),
				timerNode = cnt.one('.tappoo-timer');
			this.showDeck('act');
			this.results = [];
			t = Y.later(1000, this, function() {
					s++;
					if (s === detail.duration) {
						t.cancel();
						this.end();
					}
					timerNode.setContent(Y.Lang.sub("{m}:{s}", {
								'm': parseInt(s / 60, 10),
								's': s % 60
							}));
				}, [], true);
			this.showNextCard();
		
		},
		end: function() {
			this.showDeck('post');
			var cnt = this.get('container');
			// mostrare il riepilogo
			cnt.one('.tappoo-cards').setContent(Y.Array.map(this.results, function(t) {
					return "<li><label><input type='checkbox' "+((t.score) ? "checked" : "")+">"+t.word+"</label></li>"
				}).join(''));
		},
		finish: function() {
			
		}
	}, {
		ATTRS: {
			detail: {}
		}
	});
	
	
	Y.GameBoard = Y.Base.create('GameBoard', Y.App, [], {
		initializer: function(cfg) {
			this.route('/', function() {
					this.showView('main');
				}, this);
			this.on('MainView:startGame', function(e) {
					// turno 1, squadra 0
					var rq = [],
						duration = this.get('duration');
					for (var t = 0, T = this.get('rounds'); t <T; t++) {
						Y.Object.each(this.get('teams'), function(team, id_team) {
							team = Y.merge(team, {'id_team': id_team});
							rq.push({'round': t, 'team': team, 'duration': duration});
						});
					}
					this._roundQueue = rq;
					Y.log('Round begins');
					Y.log(rq);
					this.fire('nextRound');
				}, this);
			this.on('MainView:teamNameChange', function(e) {
					Y.log('Changing team ('+e.id_team+') name to <'+e.newVal+'>');
					this.getTeamById(e.id_team)['name'] = e.newVal;
				}, this);
			this.publish('nextRound', {
				defaultFn: this._defNextRoundFn
			});
		},
		_defNextRoundFn: function(e) {
			var r = this._roundQueue.shift();
			if (r) {
				// Ho un round, {round: n, team_id: <id>, duration: msec}
				// PRE - ACT - POST
				this.showView('round', {
						'detail': r
					});
			} else {
				// mostro la pagina iniziale.
				this.showView('main');
			}
		},
		getTeamById: function(id_team) {
			return this.get('teams')[id_team];
		},
		getTeams: function() {
			var t = [];
			Y.Object.each(this.get('teams'), function(v, k) {
				t.push(Y.merge(v, {'id_team': k}));
			});
			return t;
		},
		views: {
		    main: {
		    	type: "MainView",
		    	preserve: true
		    },
		    'round': {
		    	type: "RoundView",
		    	preserve: false
		    }
		},
		
	}, {
		ATTRS: {
			teams: {
				value: {
					0: {'name': 'Squadra A', 'score': 0, 'turns': []},
					1: {'name': 'Squadra B', 'score': 0, 'turns': []}
				},
				cloneDefaultValue: false
			},
			rounds: {
				value: 4
			},
			duration: {
				value: 1*60 // 5min
			},
			currentRound: {
				value: 0
			},
			currentTeam: {}
		}
	});
	
	Y.on('domready', function() {
		var gb = new Y.GameBoard({
				serverRouting	: false,
				transitions		: true,
			}),
			teams = gb.getTeams();
	
		gb.render().showView('main', {'teams': teams});
		YUI.namespace('png').gb = gb;
	});

});		
