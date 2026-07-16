# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Selected design direction

- Use the second concept, “探索书海”, as the durable visual direction: a calm ocean-map discovery space, left-side student navigation, explainable recommendations, real book-cover imagery, and a blue/mint school-safe palette.
- Keep the student journey primary while preserving clear parent and teacher entry points.
- Treat interaction depth as part of the product quality bar: keep at least 100 searchable book records, make all four primary navigation tabs switch to distinct views, and make reading completion visibly update the five-domain star map.
- Show a concrete recommended age range for every book, not only a generic difficulty label.
- Treat illustrations as part of the low-age reading experience: prefer open/public-domain images from the source edition, place them through the text when available, and never repeat one image merely to simulate density.
- Keep page position explicit in the reader with a current-page/total-pages indicator and page-turn controls.
- The social layer should use real friend codes and durable shared progress; adding a friend must reveal that reader's actual public check-in summary.
- Keep a current-page learning assistant on the reader's right side: select vocabulary for the book's recommended age, and show pronunciation, Chinese meaning, part of speech, an English definition, the sentence in context, and one-tap word audio.
- Clicking a vocabulary card should highlight that word in the reading page and smoothly locate its nearest visible occurrence; clicking the selected card again clears the highlight.
- Every book must be listenable in the reader. Prefer a correctly matched LibriVox public-domain human recording with chapters; use device English speech synthesis for the current page whenever no reliable human recording exists.
