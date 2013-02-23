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

	var viewRender = function() {
		Y.log("Rendering "+this.name);
		var info = this.get('detail');
		Y.log(info);
		this.get('container').setContent(this.templateFn(info));
	};

	Y.RoundPreView = Y.Base.create('RoundPreView', Y.View, [], {
		templateFn: getTemplate('#round-pre-tmpl'),
		render: viewRender,
		events: {
			'#tappoo-startround': {
				'click': '_onStartRound'
			}			
		},
		_onStartRound: function(e) {
			this.fire('startRound');
		}
	});
	
	Y.RoundActView = Y.Base.create('RoundActView', Y.View, [], {
		templateFn: getTemplate('#round-act-tmpl'),
		render: function() {
			viewRender.apply(this);
			this.showNextCard();
		},
		events: {
			'#tappoo-pass': {
				'click': '_onPass'
			},
			'#tappoo-done': {
				'click': '_onDone'
			}
		},
		initializer: function() {
			/* This class should be discarded and recreated upon every round.
			*/
			Y.log(this.name + " initialized");
			this.on('endCard', function(e) {
				this.showNextCard();
			}, this);
		},
		_onPass: function(e) { this.fire('endCard', {'score': -1, 'card': this.card}); },
		_onDone: function(e) { this.fire('endCard', {'score': 1, 'card': this.card}); },
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
		updateClock: function(s) {
			// let's cache the access to the timerNode.
			this._timerNode = this._timerNode || this.get('container').one('.tappoo-timer');
			this._timerNode.setContent(Y.Lang.sub("{m}:{s}", {
				'm': parseInt(s / 60, 10),
				's': s % 60
			}));
		},
		setClockUrgency: function(percentage) {
			/* FIXME
				update the timerNode class to reveal the urgency of the timer.
			*/
		}
	}, {
		ATTRS: {
			detail: {}
		}
	});

	Y.RoundPostView = Y.Base.create('RoundPostView', Y.View, [], {
		templateFn: getTemplate('#round-post-tmpl'),
		render: viewRender,
		events: {
			'.tappoo-gonext': {
				'click': '_onNext'
			}
		},
		_onNext: function(e) { 
			var cnt = this.get('container'),
				score = Y.Array.reduce(cnt.all('.tappoo-cards input[type=checkbox]'), 0, function(p, c) {
					return (c.get('checked') ? 1 : -1);
				});
			this.fire('confirmRound', {score: score});
		}
	}, {
		ATTRS: {
			detail: {}
		}
	});

	
	Y.GameBoard = Y.Base.create('GameBoard', Y.App, [], {
		/* This is the App class that works as a main router and event target.
			Here are the events that it can receive from the views:
			- teamNameChage
			- startGame
			- 


		*/
		initializer: function(cfg) {
			this.route('/', function() {
				this.showView('main');
			}, this);
			this.on('*:endRound', function(e) {
				Y.log('Round ends, results:');
				Y.log(e.results);
				this.showView('roundPost', {'detail': {results: e.results}});
			}, this);
			this.on('MainView:startGame', function(e) {
				Y.log('Game begins, building rounds queue and showing RoundPreView');
				this._roundQueue = this.buildRoundsQueue();
				Y.log(this._roundQueue);
				this._currentRound = this._roundQueue.shift();
				this.showView('roundPre', {'detail': this._currentRound});
			}, this);
			this.on('RoundPreView:startRound', function(e) {
				Y.log('Round begins, switching view');
				var h, s = 0, d = this.get('duration');
				this.showView('roundAct', {'detail': this._currentRound});
				this.results = [];
				// Activating countdown
				h = Y.later(1000, this, function() {
					s++;
					var v = this.get('activeView');
					v.updateClock(s);
					if (s === d) {
						h.cancel();
						Y.log('Timeout');
						this.fire('endRound', {'results': this.results});
					}
				}, [], true);
			}, this);
			this.on('*:endCard', function(e) {
				var score = e.score,
					word = e.card;
				this.results.push({
						'id_team': this._currentRound.team.id_team,
						'word': word,
						'score': score
					});
				Y.log('Updating results');
				Y.log(this.results);
			});
			this.on('MainView:teamNameChange', function(e) {
				Y.log('Changing team ('+e.id_team+') name to <'+e.newVal+'>');
				this.getTeamById(e.id_team)['name'] = e.newVal;
			}, this);
		},
		buildRoundsQueue: function() {
			var rq = [],
				duration = this.get('duration'),
				teams = this.get('teams'),
				t = 0, T = this.get('rounds');
			for (; t <T; t++) {
				Y.Object.each(teams, function(team, id_team) {
					team = Y.merge(team, {'id_team': id_team});
					rq.push({'round': t, 'team': team, 'duration': duration});
				});
			}
			return rq;
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
		    'roundPre': {
		    	type: "RoundPreView",
		    	preserve: true
		    },
		    'roundAct': {
		    	type: "RoundActView",
		    	preserve: false
		    },
		    'roundPost': {
		    	type: "RoundPostView",
		    	preserve: true
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
