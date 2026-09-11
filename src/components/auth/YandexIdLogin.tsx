export default function YandexIdLogin() {
  return (
    <a
      href="/auth/yandex"
      className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path
            fill="#FC3F1D"
            d="M13.69 20h-2.42V8.15c-1.88.1-2.86.92-2.86 2.32 0 1.12.48 1.86 1.52 2.61l1.05.76L7.96 20H5.34l2.78-5.48c-1.6-1.14-2.28-2.28-2.28-3.91C5.84 7.57 7.96 6 12.15 6h1.54v14Z"
          />
        </svg>
      </span>
      Войти с Яндекс ID
    </a>
  );
}
