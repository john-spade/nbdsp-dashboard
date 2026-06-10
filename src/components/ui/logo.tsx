import { cn } from "@/lib/utils/cn";

export const UP_SEAL_URL = "https://up.edu.ph/wp-content/uploads/2020/01/UP-Seal.png";

/** University of the Philippines seal. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={UP_SEAL_URL}
      alt="University of the Philippines seal"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
