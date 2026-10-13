# Sho Call — Style guide

## Identity and reference precedence

Use **Sho Call**, including the space and two final L letters. Earlier filenames say ShoCal; retain filenames for mapping but correct visible app text. Use **Verdigen** for the parent brand, subtly in About/login/footer. Logo: three stacked rounded bars and wordmark. Use brand/sho-call-color.png on suitable backgrounds, white on dark and black on light. Keep proportions and transparent padding; do not crop letter edges or add a new mark. Raster logo references may have edge/glow artifacts: inspect them before production use. Do not redraw or substitute the identity without approval.

The product reference images establish visual direction, not literal copy or precise layout. They contain fictional and potentially garbled generated text. Rebuild interface content as real text and components using the specifications. Never use a screenshot as the functional console.

## Palette

| Token | Value | Use |
|---|---|---|
| director.shell | #241C10 | Director background |
| director.panel | #3E2F17 | Secondary Director surfaces |
| director.accent | #F4C76B | Director identity and active/upcoming call accents |
| crew.shell | #081B30 | Department background |
| crew.accent | #2A9DF4 | Department controls/identity |
| history.muted | #8592A3 | Completed history |
| text.primary | #F5F7FB | Proposed primary text |
| text.secondary | #BCC7D5 | Proposed secondary text |
| status.ready | #73D9AD | Proposed ready/complete accents |
| status.warning | #FFD080 | Proposed standby/hold accents |
| status.issue | #FF8B95 | Proposed issue/error accents |

The first five colors are established project tokens; the remaining tokens are implementation suggestions. Validate every final foreground/background pairing for contrast. Color does not replace text labels. Blue crew screens retain gold highlighting for the relevant Director call. White text on saturated blue may need a darker button shade.

## Typography and spacing

Use a clean system sans-serif stack to minimize setup and keep performance predictable. Suggested sizes: 28–36px page title, 20–24px cue title, 16–18px primary cue instruction, 14–16px labels/body, 12–13px secondary metadata. Avoid making critical instructions tiny to fit a mockup. Use tabular numerals for clocks, cue times and numbers. Timers may be 32–48px where helpful. Weight 600 for labels and 700 for cue status. Use sentence case except concise state badges.

Suggested spacing scale: 4, 8, 12, 16, 24, 32, 48px. Main panels use 16–24px padding; row spacing is generous enough to read in a busy show environment. Suggested radii: 10px controls, 16px panels, 20px modal shells. Avoid glass blur behind dense data if it hurts clarity.

## Liquid Glass direction

Premium Apple Liquid Glass-inspired styling: restrained translucent surfaces, soft borders, subtle depth, elegant controls, gentle cyan/violet brand accents. Director workspaces remain bronze/gold rather than turning every screen blue. Use opaque readable fallbacks beneath glass. Keep large atmospheric ribbons and decorative gradients to login/landing/header areas; live cue content needs calm high-contrast surfaces.

Suggested panels: tinted fill at 90%+ effective opacity, 1px subtle border, low-spread shadow and optional modest backdrop blur. Keep important state labels crisp. Avoid glow on all text, excessive reflections and constant animation.

## Components

- App shell: product mark, show/session title, role/department, rehearsal/live badge, connection indicator, profile.
- Cue row: cue number, scheduled/estimated time, department icon+label, instruction and status. Include group indicator when linked.
- Focus card: current cue, full instruction, clear Director state, Approx. countdown and action area.
- Status chip: visible word plus icon/shape; support pending, prepared, standby, called, held, skipped, complete and issue.
- Action buttons: Go is the strongest clear action. Standby secondary; Hold/Skip visually distinct. Disabled controls include an explanation.
- Department selector: icon+label, multi-select where permitted, explicit Apply/Reset or instant filtering with clear feedback.
- Edit drawer: clear sections, Save Draft/Apply Changes, validation, dirty-state protection.
- Activity feed: timestamp, actor, action, target and revision; legible muted history.
- Empty/loading/error states: explain the condition and next action; no endless spinner on network failure.

## Icons

Director: group/people. Video: camera. Audio: headphones. Lighting: bulb. Stage Manager: stage/person. Other departments: consistent icon family plus visible label. Use a maintained icon library already available in the repo or simple accessible vector icons. The same icon must follow each department across screens. Keep icons around 16–20px in tables and 20–24px in navigation; smaller phone/tablet identifiers preserve cue space. Never use an icon alone to identify a department.

## Responsive and accessibility rules

Suggested breakpoints: below 640px phone, 640–1023px tablet, 1024px+ desktop; adapt based on content. Use 44px minimum touch targets. A phone uses stacked cue cards rather than a shrunken spreadsheet. Preserve important cues and controls in landscape and portrait. Desktop can show overview+focus+crew status; tablet keeps two columns where readable.

Visible focus rings, semantic buttons, form labels, keyboard access, understandable error messages and screen-reader-friendly status announcements are required. Announce important changes selectively; do not announce every countdown tick. Avoid flashing alerts. Support reduced motion and 200% zoom. Check WCAG AA contrast targets. Completed history must remain readable, not disappear into low-opacity decoration.

## Motion

Suggested duration: 120–180ms hover/press, 180–240ms drawers and panels. Use opacity and tiny transforms, with stable layout. Subtle hover highlights and press feedback satisfy the design direction. No continuous pulsing that distracts from cues. Reduced motion removes decorative movement. A live update should be noticeable without moving a control under the user's pointer.
