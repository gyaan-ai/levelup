# School logos (coaches)

Place **official school logos** here so they appear next to coaches on browse, profiles, and booking.

## Supported schools (start with these)

| School   | File name     | Notes |
|----------|---------------|--------|
| UNC      | `unc.png`     | University of North Carolina |
| NC State | `nc-state.png`| NC State University |

## How to add logos

1. **Get the official logo** from the school’s athletics or brand site (e.g. goheels.com, gopack.com, or their brand guidelines).
2. **Save the file** in this folder with the exact name above:
   - `unc.png` for UNC
   - `nc-state.png` for NC State
3. Prefer **PNG** with transparent background; **SVG** is also supported (use `.svg` and we can wire it in if needed).

After adding the files, coaches whose **School** is set to “UNC” or “NC State” will see the logo next to their school name in the app.

## Adding more schools

To support another school:

1. Add the logo file here (e.g. `duke.png`).
2. In the codebase, add the mapping in `lib/school-logos.ts` in `SCHOOL_LOGO_SLUGS`, e.g. `'Duke': 'duke'`.
