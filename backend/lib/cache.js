const store = new Map()

export const cache = {
  get(key) {
    return store.get(key) ?? null
  },

  set(key, value) {
    store.set(key, value)
  },

  del(key) {
    store.delete(key)
  },

  // Elimina todas las entradas que empiecen con el prefijo (ej: "plan:")
  delByPrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key)
    }
  },
}
