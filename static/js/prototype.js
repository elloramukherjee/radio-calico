(() => {
  const list = document.getElementById('items');
  const form = document.getElementById('add-form');
  const input = document.getElementById('name-input');

  async function loadItems() {
    const res = await fetch('/api/items');
    const items = await res.json();
    list.innerHTML = '';
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item.name;
      const del = document.createElement('button');
      del.className = 'btn-secondary btn-small';
      del.textContent = 'Delete';
      del.onclick = async () => {
        await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
        loadItems();
      };
      li.appendChild(del);
      list.appendChild(li);
    }
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.value }),
    });
    input.value = '';
    loadItems();
  };

  loadItems();
})();
