import { version } from "../../package.json";

export default function ReleaseVersion() {
  return <span className="release-version" aria-label={`CorkWill Log version ${version}`}>CorkWill Log <span>v{version}</span></span>;
}
