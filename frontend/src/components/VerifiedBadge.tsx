import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCertificate, faCheck } from "@fortawesome/free-solid-svg-icons";

export function VerifiedBadge({
  label,
  size = "md",
}: {
  label: string;
  size?: "sm" | "md";
}) {
  const dimensions = size === "sm" ? "h-[18px] w-[18px]" : "h-6 w-6";
  const checkSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span
      aria-label={label}
      title={label}
      className={`relative inline-grid ${dimensions} shrink-0 place-items-center text-sky-700 drop-shadow-sm dark:text-sky-400`}
    >
      <FontAwesomeIcon icon={faCertificate} className="h-full w-full" aria-hidden="true" />
      <FontAwesomeIcon icon={faCheck} className={`absolute ${checkSize} text-white`} aria-hidden="true" />
    </span>
  );
}
