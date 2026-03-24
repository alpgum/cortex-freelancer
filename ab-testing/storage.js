/**
 * Storage wrapper (localStorage with in-memory fallback).
 */

const memory = new Map();

function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function getItem(key) {
  if (hasLocalStorage()) return window.localStorage.getItem(key);
  return memory.has(key) ? memory.get(key) : null;
}

function setItem(key, value) {
  if (hasLocalStorage()) return window.localStorage.setItem(key, value);
  memory.set(key, value);
}

function removeItem(key) {
  if (hasLocalStorage()) return window.localStorage.removeItem(key);
  memory.delete(key);
}

module.exports = { getItem, setItem, removeItem, hasLocalStorage };
