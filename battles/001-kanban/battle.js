const promptText = 'Создай канбан-доску с колонками «К выполнению», «В работе» и «Готово» и перетаскиваемыми карточками. Добавь возможность создавать, редактировать и удалять карточки с заголовками и описаниями, а также счётчики карточек в каждой колонке. Сохраняй состояние доски в локальном хранилище и добавь плавную анимацию при перетаскивании.';
const copyButton = document.getElementById('copyPrompt');
if (copyButton) copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(promptText);
    copyButton.textContent = '✓ Промт скопирован';
    setTimeout(() => copyButton.textContent = '▣ Скопировать промт', 1800);
  } catch {
    copyButton.textContent = 'Не удалось скопировать — выдели текст вручную';
  }
});