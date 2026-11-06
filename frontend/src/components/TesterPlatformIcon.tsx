import { Apple, Globe, Laptop, Smartphone, type LucideIcon } from "lucide-react";

export const testerPlatformOptions = [
  { value: "IOS", label: "ios", icon: Apple },
  { value: "ANDROID", label: "android", icon: Smartphone },
  { value: "WEB", label: "web", icon: Globe },
  { value: "DESKTOP", label: "desktop", icon: Laptop },
] as const;

export type TesterPlatform = typeof testerPlatformOptions[number]["value"];

const platformIcons: Record<TesterPlatform, LucideIcon> = {
  IOS: Apple,
  ANDROID: Smartphone,
  WEB: Globe,
  DESKTOP: Laptop,
};

export function TesterPlatformIcon({
  platform,
  size = 14,
  className,
}: {
  platform: TesterPlatform;
  size?: number;
  className?: string;
}) {
  const Icon = platformIcons[platform];
  return <Icon size={size} className={className} aria-hidden="true" />;
}
