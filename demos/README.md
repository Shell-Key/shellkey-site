# Demo files

Drop each product's demo HTML here, named by the product slug, e.g.

    demos/inspection-system.html
    demos/ai-website-studio.html
    demos/digital-project-tracker.html

Then in build_store.py add `demo="demos/<slug>.html"` to that product (or a full URL
for demos hosted elsewhere, like Bid Board), run `python build_store.py`, commit.

The store shows a "Try the free demo" button for every product with a demo. The demo
opens inside demo.html: visitor gives name + email once (lands in the CRM as a demo lead),
then sees the demo with Buy / Request purchase / Request customization always on top.
