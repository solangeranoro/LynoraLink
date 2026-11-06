import type { ComponentProps } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import { faGithub, faXTwitter } from "@fortawesome/free-brands-svg-icons";

type IconProps = Omit<ComponentProps<typeof FontAwesomeIcon>, "icon" | "size" | "strokeWidth"> & {
  size?: number;
};

function makeIcon(definition: IconDefinition) {
  return function FontAwesomeMappedIcon({ size = 24, style, ...props }: IconProps) {
    return <FontAwesomeIcon icon={definition} style={{ fontSize: size, ...style }} {...props} />;
  };
}

export const Activity = makeIcon(solid.faChartLine);
export const ArrowDown = makeIcon(solid.faArrowDown);
export const ArrowDownToLine = makeIcon(solid.faArrowsDownToLine);
export const ArrowLeft = makeIcon(solid.faArrowLeft);
export const ArrowRight = makeIcon(solid.faArrowRight);
export const ArrowUpRight = makeIcon(solid.faArrowUpRightFromSquare);
export const AtSign = makeIcon(solid.faAt);
export const BadgeCheck = makeIcon(solid.faCircleCheck);
export const BarChart3 = makeIcon(solid.faChartColumn);
export const Bell = makeIcon(solid.faBell);
export const BellRing = makeIcon(solid.faBell);
export const BriefcaseBusiness = makeIcon(solid.faBriefcase);
export const Bot = makeIcon(solid.faRobot);
export const CalendarDays = makeIcon(solid.faCalendarDays);
export const CalendarRange = makeIcon(solid.faCalendarDays);
export const Camera = makeIcon(solid.faCamera);
export const Check = makeIcon(solid.faCheck);
export const ChevronDown = makeIcon(solid.faChevronDown);
export const ChevronLeft = makeIcon(solid.faChevronLeft);
export const ChevronRight = makeIcon(solid.faChevronRight);
export const ChevronUp = makeIcon(solid.faChevronUp);
export const CircleDollarSign = makeIcon(solid.faDollarSign);
export const CircleDot = makeIcon(solid.faCircleDot);
export const Code2 = makeIcon(solid.faCode);
export const Copy = makeIcon(solid.faCopy);
export const Compass = makeIcon(solid.faCompass);
export const CornerDownRight = makeIcon(solid.faReply);
export const Crown = makeIcon(solid.faCrown);
export const Eye = makeIcon(solid.faEye);
export const EyeOff = makeIcon(solid.faEyeSlash);
export const ExternalLink = makeIcon(solid.faArrowUpRightFromSquare);
export const FileCode2 = makeIcon(solid.faFileCode);
export const FileText = makeIcon(solid.faFileLines);
export const Flame = makeIcon(solid.faFire);
export const FolderKanban = makeIcon(solid.faFolderOpen);
export const FolderPlus = makeIcon(solid.faFolderPlus);
export const Github = makeIcon(faGithub);
export const Globe2 = makeIcon(solid.faGlobe);
export const GraduationCap = makeIcon(solid.faGraduationCap);
export const Handshake = makeIcon(solid.faHandshake);
export const Heart = makeIcon(solid.faHeart);
export const Image = makeIcon(solid.faImage);
export const ImagePlus = makeIcon(solid.faImage);
export const Inbox = makeIcon(solid.faInbox);
export const KeyRound = makeIcon(solid.faKey);
export const Languages = makeIcon(solid.faLanguage);
export const Lightbulb = makeIcon(solid.faLightbulb);
export const Link2 = makeIcon(solid.faLink);
export const LayoutDashboard = makeIcon(solid.faTableCellsLarge);
export const Loader2 = makeIcon(solid.faSpinner);
export const LoaderCircle = makeIcon(solid.faSpinner);
export const Lock = makeIcon(solid.faLock);
export const LockKeyhole = makeIcon(solid.faLock);
export const LogOut = makeIcon(solid.faRightFromBracket);
export const Mail = makeIcon(solid.faEnvelope);
export const MailCheck = makeIcon(solid.faEnvelopeCircleCheck);
export const MapPin = makeIcon(solid.faLocationDot);
export const Megaphone = makeIcon(solid.faBullhorn);
export const MessageCircle = makeIcon(solid.faComment);
export const MessageCircleMore = makeIcon(solid.faCommentDots);
export const MessageSquareText = makeIcon(solid.faCommentDots);
export const MessagesSquare = makeIcon(solid.faComments);
export const Monitor = makeIcon(solid.faDesktop);
export const Moon = makeIcon(solid.faMoon);
export const MoreHorizontal = makeIcon(solid.faEllipsis);
export const PackagePlus = makeIcon(solid.faBoxOpen);
export const Paperclip = makeIcon(solid.faPaperclip);
export const Pause = makeIcon(solid.faPause);
export const Pencil = makeIcon(solid.faPen);
export const Phone = makeIcon(solid.faPhone);
export const PollFeedback = makeIcon(solid.faSquarePollVertical);
export const Play = makeIcon(solid.faPlay);
export const Plus = makeIcon(solid.faPlus);
export const Radio = makeIcon(solid.faTowerBroadcast);
export function ReviewIcon({ size = 24, style, className, ...props }: IconProps) {
  return (
    <span
      className={`relative inline-block shrink-0 align-middle leading-none ${className ?? ""}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden={props["aria-hidden"]}
      aria-label={props["aria-label"]}
      title={props.title}
    >
      <FontAwesomeIcon icon={solid.faComment} className="h-full w-full" aria-hidden="true" />
      <FontAwesomeIcon icon={solid.faStar} className="absolute -right-[8%] -top-[8%] h-[55%] w-[55%] rounded-full bg-midnight-card p-[3%] text-current" aria-hidden="true" />
    </span>
  );
}
export const Rocket = makeIcon(solid.faRocket);
export const Save = makeIcon(solid.faFloppyDisk);
export const Search = makeIcon(solid.faMagnifyingGlass);
export const Send = makeIcon(solid.faPaperPlane);
export const Settings2 = makeIcon(solid.faGear);
export const Share2 = makeIcon(solid.faShare);
export const ShieldCheck = makeIcon(solid.faShieldHalved);
export const ShoppingBag = makeIcon(solid.faBagShopping);
export const SlidersHorizontal = makeIcon(solid.faSliders);
export const Sparkles = makeIcon(solid.faWandMagicSparkles);
export const Star = makeIcon(solid.faStar);
export const Store = makeIcon(solid.faStore);
export const Sun = makeIcon(solid.faSun);
export const Target = makeIcon(solid.faBullseye);
export const ThumbsUp = makeIcon(solid.faThumbsUp);
export const Trash2 = makeIcon(solid.faTrash);
export const Clock3 = makeIcon(solid.faClock);
export const Trophy = makeIcon(solid.faTrophy);
export const Twitter = makeIcon(faXTwitter);
export const AlertTriangle = makeIcon(solid.faTriangleExclamation);
export const Type = makeIcon(solid.faTextHeight);
export const User = makeIcon(solid.faUser);
export const UserPlus = makeIcon(solid.faUserPlus);
export const UserRound = makeIcon(solid.faUser);
export const UserRoundPen = makeIcon(solid.faUserPen);
export const Users = makeIcon(solid.faUsers);
export const UsersRound = makeIcon(solid.faUsers);
export const Video = makeIcon(solid.faVideo);
export const WalletCards = makeIcon(solid.faWallet);
export const WandSparkles = makeIcon(solid.faWandMagicSparkles);
export const Wrench = makeIcon(solid.faWrench);
export const X = makeIcon(solid.faXmark);