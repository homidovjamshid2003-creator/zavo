const form = document.querySelector('#number-form');
const input = document.querySelector('#number');
const result = document.querySelector('#natija');

function animateResult(isError = false) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  result.animate(isError
    ? [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }]
    : [{ opacity: 0.35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
  { duration: isError ? 280 : 400, easing: 'ease-out' });
}

function checkNumber() {
  const value = input.value.trim().replace(',', '.');
  const number = Number(value);
  document.querySelectorAll('[data-number]').forEach(button => {
    const selected = value !== '' && Number(button.dataset.number) === number;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  result.replaceChildren();
  if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(number)) {
    result.className = 'result error';
    result.textContent = 'Iltimos, to‘g‘ri son kiriting.';
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    animateResult(true);
    return;
  }
  input.removeAttribute('aria-invalid');
  result.className = 'result complete';
  const heading = document.createElement('strong');
  heading.className = 'result-number';
  heading.textContent = String(number);
  const details = document.createElement('div');
  const title = document.createElement('p');
  title.textContent = 'Soningiz haqida';
  const badges = document.createElement('div');
  badges.className = 'badges';
  const properties = [number === 0 ? 'Nol' : number > 0 ? 'Musbat' : 'Manfiy'];
  properties.push(Number.isInteger(number) ? (number % 2 === 0 ? 'Juft' : 'Toq') : 'Kasr son');
  properties.push(number % 5 === 0 ? '5 ga bo‘linadi' : '5 ga qoldiqsiz bo‘linmaydi');
  properties.forEach(property => {
    const badge = document.createElement('span');
    badge.textContent = property;
    badges.append(badge);
  });
  details.append(title, badges);
  result.append(heading, details);
  animateResult();
}
form.addEventListener('submit', event => { event.preventDefault(); checkNumber(); });
document.querySelectorAll('[data-number]').forEach(button => {
  button.addEventListener('click', () => { input.value = button.dataset.number; checkNumber(); });
});
document.querySelector('#year').textContent = new Date().getFullYear();

const calculator = document.querySelector('.calculator');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let tiltFrame = 0;
calculator.addEventListener('pointermove', event => {
  if (motionPreference.matches || !precisePointer.matches) return;
  cancelAnimationFrame(tiltFrame);
  tiltFrame = requestAnimationFrame(() => {
    const bounds = calculator.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    calculator.style.setProperty('--tilt-x', `${-y * 5}deg`);
    calculator.style.setProperty('--tilt-y', `${x * 5}deg`);
  });
});
function resetTilt() {
  cancelAnimationFrame(tiltFrame);
  calculator.style.setProperty('--tilt-x', '0deg');
  calculator.style.setProperty('--tilt-y', '0deg');
}
calculator.addEventListener('pointerleave', resetTilt);
motionPreference.addEventListener('change', resetTilt);
precisePointer.addEventListener('change', resetTilt);
