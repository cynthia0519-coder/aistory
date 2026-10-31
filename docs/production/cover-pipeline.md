# Cover generation spec (batch N)

Input: prompts<N>.json in this folder: {"<story-id>": "<scene>"}.
Output: raw/<story-id>.jpg (1920x1080 JPG) for every id, plus media<N>.json {"<story-id>": "<canva media id>"}.

1. For each id, call mcp__Canva__generate-image with
   aspectRatio "LANDSCAPE_16_9" and prompt = STYLE + " Scene: " + scene + " No text, no letters, no numbers, no logos."
   STYLE = "Children's picture book illustration in textured gouache and risograph style. Warm palette dominated by mustard yellow, ochre and burnt orange, with brick red, small accents of deep teal and dark olive green. Visible paper grain and dry-brush texture, slightly uneven hand-painted edges, flat naive perspective, cozy calm bedtime mood. The main subject is centered with generous empty margin on the left and right."
   You may start several jobs before polling. Poll mcp__Canva__get-generate-image-job (wait ~15s between polls via `sleep 15` in Bash) until SUCCESS; record the MEDIA id in media<N>.json (write the file incrementally so progress survives). On FAILURE retry once; if it fails again, record it and move on.
   Look at the returned preview: if it clearly contains visible text/letters, a scary/dangerous scene, or obviously broken anatomy, regenerate once.
2. Full resolution: the preview is tiny, so place the images in a Canva design and export:
   - mcp__Canva__create-design a blank Presentation (16:9, 1920x1080) named "aistory covers batch N" (your own design; never touch other designs).
   - read-design with open_transaction to get page ids; then ONE edit-design call (finalize "keep_open") whose operations array holds every add_page / insert_fill / update_fill for the whole batch (each image fills a page: top 0, left 0, width 1920, height 1080), keeping a page-index -> id list; then ONE edit-design call with finalize "commit" and no operations. Every edit-design call asks the user for permission, so never place images one call at a time.
   - mcp__Canva__export-design format {"type":"jpg","quality":92,"width":1920,"height":1080} (all pages, or in chunks of pages). Poll if async.
   - Download each page URL with curl into raw/<story-id>.jpg (URLs are signed; download promptly). Verify each file is a 1920x1080 JPEG (python3 PIL or `file`).
3. Reply with: count done, list of ids that failed or were regenerated, and the design id.
Do not edit anything in the git repo.
