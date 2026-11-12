(() => {
  const root = document.getElementById('participantVote');
  if (!root) return;

  const participant = root.dataset.participant;
  const participantName = root.dataset.name;
  const nextUrl = root.dataset.next;
  const nextName = root.dataset.nextName;
  const step = Number(root.dataset.step);
  const participants = [
    { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'claude', name: 'Claude' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'qwen', name: 'Qwen' },
    { id: 'kimi', name: 'Kimi' },
    { id: 'alice', name: 'Алиса' }
  ];
  const storageKey = 'ai-battle-001-progress';
  const form = root.querySelector('form');
  const rating = root.querySelector('[name="rating"]');
  const favorite = root.querySelector('[name="favorite"]');
  const status = root.querySelector('.participant-vote-status');
  const next = root.querySelector('.participant-next');
  const progress = root.querySelector('.participant-progress-fill');
  const progressText = root.querySelector('.participant-progress-text');
  const submit = root.querySelector('button[type="submit"]');

  const readState = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || { ratings: {}, favorite: null, submitted: false };
    } catch {
      return { ratings: {}, favorite: null, submitted: false };
    }
  };
  const saveState = state => localStorage.setItem(storageKey, JSON.stringify(state));
  const getVoterId = () => {
    const key = 'ai-battle-voter-id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  };
  const setStatus = (message, type) => {
    status.textContent = message;
    status.className = 'participant-vote-status' + (type ? ' ' + type : '');
  };
  const updateProgress = state => {
    const count = Object.keys(state.ratings).filter(id => participants.some(p => p.id === id)).length;
    progress.style.width = (count / participants.length * 100) + '%';
    progressText.textContent = 'Оценено ' + count + ' из 6 участников';
  };
  const showNext = () => {
    next.hidden = false;
    next.textContent = step === 6 ? 'Вернуться к участникам батла ↗' : 'Перейти к следующему участнику: ' + nextName + ' →';
  };

  let state = readState();
  if (state.ratings[participant]) rating.value = String(state.ratings[participant]);
  favorite.checked = state.favorite === participant;
  updateProgress(state);

  if (state.submitted) {
    setStatus('Ваш голос уже принят. Спасибо за участие в AI BATTLE!', 'success');
    submit.disabled = true;
    showNext();
  } else if (state.ratings[participant]) {
    setStatus('Оценка ' + participantName + ' сохранена на этом устройстве. Можно перейти дальше или изменить её.', 'success');
    showNext();
  }

  favorite.addEventListener('change', () => {
    state = readState();
    state.favorite = favorite.checked ? participant : (state.favorite === participant ? null : state.favorite);
    saveState(state);
    setStatus(state.favorite
      ? '⭐ ' + participants.find(p => p.id === state.favorite).name + ' выбран фаворитом. Не забудьте сохранить оценку.'
      : 'Выбор фаворита снят. Можно выбрать его на странице любого участника.', '');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!rating.value) {
      setStatus('Сначала выберите оценку от 1 до 5.', 'error');
      rating.focus();
      return;
    }

    state = readState();
    state.ratings[participant] = Number(rating.value);
    state.favorite = favorite.checked ? participant : (state.favorite === participant ? null : state.favorite);
    saveState(state);
    updateProgress(state);
    showNext();

    const completed = participants.every(person => Number.isInteger(state.ratings[person.id]) && state.ratings[person.id] >= 1 && state.ratings[person.id] <= 5);
    if (!completed) {
      const left = participants.length - Object.keys(state.ratings).length;
      setStatus('Оценка ' + participantName + ' сохранена! Осталось оценить ещё ' + left + ' участник(ов). ' +
        (state.favorite ? 'Фаворит выбран: ' + participants.find(p => p.id === state.favorite).name + '.' : 'На любой странице можно отметить фаворита звёздочкой.') +
        ' Теперь переходите дальше.', 'success');
      return;
    }

    if (!state.favorite) {
      setStatus('Все шесть работ оценены! Теперь выберите фаворита — отметьте звёздочку у этой или любой другой нейросети.', 'error');
      favorite.focus();
      return;
    }

    if (!window.AI_BATTLE_SUPABASE || !window.supabase) {
      setStatus('Оценки сохранены на устройстве, но сервис голосования пока не загрузился. Попробуйте обновить страницу.', 'error');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Отправляем все оценки…';
    setStatus('Все шесть оценок готовы. Отправляем ваш голос в AI BATTLE…', '');
    try {
      const client = window.supabase.createClient(window.AI_BATTLE_SUPABASE.url, window.AI_BATTLE_SUPABASE.publishableKey);
      const { error } = await client.from('battle_votes').insert({
        battle_id: '001-kanban',
        voter_id: getVoterId(),
        favorite_participant: state.favorite,
        ratings: state.ratings
      });

      if (error) {
        if (error.code === '23505') {
          setStatus('С этого браузера голос уже отправляли. Повторно засчитать его нельзя.', 'error');
        } else {
          setStatus('Не удалось отправить голос. Ваши оценки сохранены на устройстве — попробуйте ещё раз позже. (' + error.message + ')', 'error');
          submit.disabled = false;
          submit.textContent = 'Повторить отправку';
          return;
        }
      } else {
        state.submitted = true;
        saveState(state);
        setStatus('Готово! Все шесть оценок приняты. Спасибо за участие в AI BATTLE! 🔥', 'success');
      }
    } catch (error) {
      setStatus('Не удалось связаться с сервером. Оценки остались на устройстве — попробуйте ещё раз.', 'error');
      submit.disabled = false;
      submit.textContent = 'Повторить отправку';
    }
    if (state.submitted) {
      submit.textContent = 'Голос принят';
      showNext();
    }
  });
})();