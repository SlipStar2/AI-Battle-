(() => {
  const PARTICIPANTS = [
    { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'claude', name: 'Claude' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'qwen', name: 'Qwen' },
    { id: 'kimi', name: 'Kimi' },
    { id: 'alice', name: 'Алиса' }
  ];

  const results = document.getElementById('audienceResults');
  const form = document.getElementById('audienceVoteForm');
  const status = document.getElementById('voteStatus');

  function showResultsMessage(message, type) {
    if (!results) return;
    results.innerHTML = '';
    const note = document.createElement('p');
    note.className = 'muted-note' + (type ? ' ' + type : '');
    note.textContent = message;
    results.appendChild(note);
  }

  if (!results) return;

  if (!window.AI_BATTLE_SUPABASE || !window.supabase || typeof window.supabase.createClient !== 'function') {
    showResultsMessage('Не удалось запустить модуль рейтинга. Обновите страницу; если сообщение повторится, попробуйте позже.', 'error');
    console.error('[AI BATTLE] Supabase SDK или конфигурация не загрузились.');
    return;
  }

  const client = window.supabase.createClient(
    window.AI_BATTLE_SUPABASE.url,
    window.AI_BATTLE_SUPABASE.publishableKey
  );

  function getVoterId() {
    const key = 'ai-battle-voter-id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  function setStatus(message, type) {
    if (!status) return;
    status.textContent = message;
    status.className = 'vote-status' + (type ? ' ' + type : '');
  }

  async function loadResults() {
    showResultsMessage('Загружаем оценки…');
    results.setAttribute('aria-busy', 'true');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const { data, error } = await client
        .from('battle_vote_totals')
        .select('participant_id,rating_count,rating_sum,favorite_votes')
        .abortSignal(controller.signal);

      if (error) {
        console.error('[AI BATTLE] Ошибка загрузки народного рейтинга:', error);
        showResultsMessage('Не удалось загрузить народный рейтинг. Попробуйте обновить страницу чуть позже.', 'error');
        return;
      }

      const byId = Object.fromEntries((data || []).map(row => [row.participant_id, row]));
      const fragment = document.createDocumentFragment();

      PARTICIPANTS.forEach(person => {
        const row = byId[person.id] || { rating_count: 0, rating_sum: 0, favorite_votes: 0 };
        const average = row.rating_count > 0
          ? (Number(row.rating_sum) / Number(row.rating_count)).toFixed(2)
          : '—';

        const item = document.createElement('div');
        item.className = 'result-row';

        const name = document.createElement('span');
        name.textContent = person.name;

        const score = document.createElement('b');
        score.textContent = average;

        const details = document.createElement('small');
        details.textContent = row.rating_count + ' оценок · ' + row.favorite_votes + ' голосов фаворита';

        item.append(name, score, details);
        fragment.appendChild(item);
      });

      results.replaceChildren(fragment);
      results.setAttribute('aria-label', 'Народный рейтинг загружен');
    } catch (error) {
      console.error('[AI BATTLE] Сбой при загрузке народного рейтинга:', error);
      const message = error && error.name === 'AbortError'
        ? 'Сервер отвечает слишком долго. Проверьте подключение и обновите страницу.'
        : 'Не удалось связаться с сервером рейтинга. Попробуйте обновить страницу.';
      showResultsMessage(message, 'error');
    } finally {
      clearTimeout(timeoutId);
      results.removeAttribute('aria-busy');
    }
  }

  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const ratings = {};
    const visited = [];

    PARTICIPANTS.forEach(person => {
      const rating = form.querySelector('[name="rating-' + person.id + '"]');
      const check = form.querySelector('[name="visited-' + person.id + '"]');
      if (rating) ratings[person.id] = Number(rating.value);
      if (check && check.checked) visited.push(person.id);
    });

    if (visited.length !== PARTICIPANTS.length) {
      setStatus('Сначала откройте все шесть демоверсий и отметьте, что проверили каждую.', 'error');
      return;
    }

    const favorite = form.querySelector('input[name="favorite"]:checked');
    if (!favorite) {
      setStatus('Выберите одного фаворита.', 'error');
      return;
    }

    if (Object.values(ratings).some(value => !Number.isInteger(value) || value < 1 || value > 5)) {
      setStatus('Поставьте оценку от 1 до 5 каждой нейросети.', 'error');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Отправляем голос…';
    setStatus('Сохраняем ваш голос…');

    try {
      const { error } = await client.from('battle_votes').insert({
        battle_id: '001-kanban',
        voter_id: getVoterId(),
        favorite_participant: favorite.value,
        ratings
      });

      if (error) {
        if (error.code === '23505') {
          setStatus('С этого браузера голос уже отправлен. Спасибо за участие!', 'success');
        } else {
          console.error('[AI BATTLE] Ошибка отправки голоса:', error);
          setStatus('Не получилось сохранить голос. Попробуйте позже.', 'error');
        }
        return;
      }

      setStatus('Голос принят! Спасибо, что проверили все работы 🔥', 'success');
      form.reset();
      await loadResults();
    } catch (error) {
      console.error('[AI BATTLE] Сбой отправки голоса:', error);
      setStatus('Не удалось отправить голос. Проверьте подключение к интернету.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Отправить мой голос';
    }
  });

  loadResults();
})();