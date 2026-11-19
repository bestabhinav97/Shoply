const paths = {
  lock: "M6 10h12v11H6z M8 10V7a4 4 0 018 0v3",
  close: "M6 6l12 12 M6 18L18 6",
  locate: "M12 2v3 M12 19v3 M2 12h3 M19 12h3 M20 12a8 8 0 11-16 0 8 8 0 0116 0 M15 12a3 3 0 11-6 0 3 3 0 016 0",
  mail: "M3 5h18v14H3z M3 5l9 7 9-7",
  phone: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.8 2.1",
  info: "M12 16v-4 M12 8h.01 M22 12a10 10 0 11-20 0 10 10 0 0120 0",
  logout: "M9 21H3V3h6 M9 12h12 M16 7l5 5-5 5",
  user: "M20 21v-2a8 8 0 00-16 0v2 M16 7a4 4 0 11-8 0 4 4 0 018 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0 M15 10a3 3 0 11-6 0 3 3 0 016 0",
  card: "M3 4h18v16H3z M3 9h18 M7 15h4",
  chevron: "M6 9l6 6 6-6",
  truck: "M3 5h11v12H3z M14 9h4l3 4v4h-7 M7 17a2 2 0 110 4 2 2 0 010-4 M17 17a2 2 0 110 4 2 2 0 010-4",
  shield: "M12 3l8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3 M8 12l3 3 5-6",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  zoom: "M21 21l-5-5 M18 10a8 8 0 11-16 0 8 8 0 0116 0 M10 6v8 M6 10h8",
  plus: "M12 5v14 M5 12h14",
  search: "M21 21l-5-5 M18 10a8 8 0 11-16 0 8 8 0 0116 0",
  check: "M5 12l4 4L19 6",
  image: "M3 3h18v18H3z M3 16l5-5 5 5 3-3 5 5 M15 7h.01",
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  products: "M3 7l9-4 9 4v10l-9 4-9-4V7z M3 7l9 4 9-4 M12 11v10 M7.5 5l9 4",
  back: "M19 12H5 M11 6l-6 6 6 6",
  bag: "M5 7h14l1 14H4L5 7z M8 7V6a4 4 0 018 0v1",
  menu: "M4 6h16 M4 12h16 M4 18h16",
};

export function Icon({ name, className }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
