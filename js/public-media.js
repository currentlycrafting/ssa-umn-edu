/**
 * Public homepage media:
 * - YouTube: set video IDs from youtube.com/watch?v=THIS_PART
 * - Local file: set a path under the site root (encode spaces as %20), e.g. assets/Aisha%20Dakol.mov
 *   If aishaTributeVideoSrc is set, it is used instead of aishaTributeYoutubeId for the tribute button.
 */
window.SSA_PUBLIC_MEDIA = {
  somaliNightYoutubeId: "",
  aishaTributeYoutubeId: "",
  aishaTributeVideoSrc: "assets/Aisha%20Dakol.mov"
};

window.SSA_POSTER = {
  /** Served from /events/… — add assets/events/somali-night-official-poster.png (or .jpg) to the repo. */
  somaliNightPosterSrc: "events/somali-night-official-poster.png"
};
