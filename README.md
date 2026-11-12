# TinyProof

**Evidence-based project progress tracking.**

TinyProof helps you track work without pretending that a manually updated percentage is proof of progress. Create projects, break them into tasks, attach evidence, and mark tasks as verified.

## MVP features

- Create and manage multiple projects.
- Add and delete tasks.
- Attach an evidence URL or a short proof note to each task.
- Mark a task as verified only after evidence has been added.
- Calculate progress from verified tasks: verified tasks / all tasks.
- Review a short activity history.
- Export and import a JSON backup.

## Run locally

No build tools, backend, account, or API key required.

1. Clone or download this repository.
2. Open `index.html` in a modern browser.

You can also publish the repository with GitHub Pages: open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.

## Data and privacy

Project data is stored in the browser's `localStorage` on the device where you use TinyProof. It is not synced between devices. Use **Export data** to create a JSON backup; **Import data** replaces the current browser data with the selected backup.

## Important limitation

In this MVP, evidence is user-supplied and verification is self-attested. TinyProof stores the evidence reference; it does **not** independently authenticate URLs, inspect GitHub commits, or prove that work happened. The progress score is therefore evidence-backed in the sense that every verified task has an attached reference, not cryptographically or externally verified.

## Project direction

The next iterations will focus on making evidence more useful and trustworthy: clearer evidence types, stronger audit history, and eventually integrations that can verify supported sources. No AI API is required for the MVP.

## License

MIT
