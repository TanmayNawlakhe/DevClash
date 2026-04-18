export function GittsuriLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Gittsurī"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" />
      <path d="M4.5 7.2H19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.3 9.1H17.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.9" />
      <path d="M8.4 9.1V16.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.6 9.1V16.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 16.2V20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.7" />
      <path d="M12 18L9.4 20.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.58" />
      <path d="M12 18L14.6 20.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.58" />
      <circle cx="9.4" cy="20.2" r="0.95" fill="currentColor" fillOpacity="0.82" />
      <circle cx="14.6" cy="20.2" r="0.95" fill="currentColor" fillOpacity="0.82" />
      <circle cx="8.4" cy="16.8" r="0.75" fill="currentColor" fillOpacity="0.68" />
      <circle cx="15.6" cy="16.8" r="0.75" fill="currentColor" fillOpacity="0.68" />
      <circle cx="12" cy="5" r="0.95" fill="currentColor" fillOpacity="0.88" />
    </svg>
  )
}
