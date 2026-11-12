(() => {
  const PARTICIPANTS = [
    { id: 'chatgpt', name: 'ChatGPT', demo: 'demos/chatgpt/' },
    { id: 'claude', name: 'Claude', demo: 'demos/claude/' },
    { id: 'deepseek', name: 'DeepSeek', demo: 'demos/deepseek/' },
    { id: 'qwen', name: 'Qwen', demo: 'demos/qwen/' },
    { id: 'kimi', name: 'Kimi', demo: 'demos/kimi/' },
    { id: 'alice', name: 'Алиса', demo: 'demos/alice/' }
  ];

  const form = document.getElementById('audienceVoteForm');
  const status = document.getElementById('voteStatus');
  const results = document.getElementById('audienceResults');
  if (!window.AI_BATTLE_SUPABASE || !window.supabase) return;

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
    status.textContent = message;
    status.className = 'vote-status' + (type ? ' ' + type : '');
  }

  async function loadResults() {
    const { data, error } = await client
      .from('battle_vote_totals')
      .select('participant_id,rating_count,rating_sum,favorite_votes');

    if (error) {
      results.innerHTML = '<p class="muted-note">Пока не удалось загрузить результаты. Попробуйте обновить страницу позже.</p>';
      return;
    }

    const byId = Object.fromEntries((data || []).map(row => [row.participant_id, row]));
    results.innerHTML = PARTICIPANTS.map(person => {
      const row = byId[person.id] || { rating_count: 0, rating_sum: 0, favorite_votes: 0 };
      const average = row.rating_count ? (row.rating_sum / row.rating_count).toFixed(2) : '—';
      return '<div class="result-row"><span>' + person.name + '</span><b>' + average + '</b><small>' +
        row.rating_count + ' оценок · ' + row.favorite_votes + ' голосов фаворита</small></div>';
    }).join('');
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
      const voterId = getVoterId();
      const { error } = await client.from('battle_votes').insert({
        battle_id: '001-kanban',
        voter_id: voterId,
        favorite_participant: favorite.value,
        ratings
      });

      if (error) {
        if (error.code === '23505') {
          setStatus('С этого браузера голос уже отправлен. Спасибо за участие!', 'success');
        } else {
          setStatus('Не получилось сохранить голос. Попробуйте позже. (' + error.message + ')', 'error');
        }
        return;
      }

      setStatus('Голос принят! Спасибо, что проверили все работы 🔥', 'success');
      form.reset();
      await loadResults();
    } catch (error) {
      setStatus('Не удалось отправить голос. Проверьте подключение к интернету.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Отправить мой голос';
    }
  });

  loadResults();
})();
