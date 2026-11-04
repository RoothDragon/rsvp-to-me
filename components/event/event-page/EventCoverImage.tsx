import NextImage from "next/image";
import styles from "../Description.module.css";

/** Keep the original upload URL, rather than opening a Next.js thumbnail. */
export function EventCoverImage({ url, alt, label }: { url: string; alt: string; label: string }) {
  let href: string | undefined;
  try {
    const parsed = new URL(url, "https://rsvp.invalid");
    if (parsed.protocol === "https:" || parsed.protocol === "http:") href = url;
  } catch {
    // Legacy invalid URLs must not become executable links.
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={styles.coverLink}
    >
      <NextImage
        src={url}
        alt={alt}
        fill
        priority
        sizes="(max-width: 600px) calc(100vw - 32px), 568px"
        style={{ objectFit: "cover" }}
      />
    </a>
  );
}
