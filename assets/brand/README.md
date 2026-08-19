# PanSphaira brand assets

These four files are the current PanSphaira product icon variants:

- `pansphaira-icon-positive.svg` and `pansphaira-icon-positive.png` for light backgrounds
- `pansphaira-icon-negative.svg` and `pansphaira-icon-negative.png` for dark backgrounds

The PNG files are byte-identical to the binding clean files in the cutover input's
`assets/brand/pansphaira/official/` directory. The SVG geometry is likewise copied
from those binding files; only the accessible title, description, and
`aria-labelledby` markup was enriched in this repository.

Binding input SHA-256 values verified before import:

- positive PNG: `925a820404a6ad8de65602170405dd5334d4c16891481fab64cfe40eb5614299`
- negative PNG: `dc15082649de21b6f6673fdb5e6d7be00c94cecb80972dcb9148ef94f6733814`
- positive SVG: `24852ad60b56beed3aed5d62508b426af6216659017977c09b205b6b3a795da5`
- negative SVG: `b97c94d1649d8ebccaa9f34d55579af8a601a58c3955a7eac72b7b4fdc263445`

## Forward asset decision

The former `chimpmaera-master.svg`, `chimpmaera-negative.svg`, and unreferenced
`chimpmaera-negative.png` are removed going forward. None is a stable technical
identifier, and compatibility copies would keep obsolete current-product artwork
and ambiguous filenames in the published asset set. Historical tags and releases
remain untouched and continue to preserve the former artwork.

README embedding and generated release/integrity indexes are intentionally updated
by their owning cutover packages, not here.
