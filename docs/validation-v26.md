# GitHub Pages update: language, onboarding and composition solids

- English document/app name: Skladka · Cloth Studio. RU/EN display translation uses an external React store. Language changes do not remount the scene or change simulation state; storage failure is tolerated.
- Both modes include language controls, translated settings, dynamic object/pin labels and errors. Boot text follows the saved language. The introductory card is dismissible, remembered locally and reopenable with ?.
- Composition accepts up to eight boxes/spheres. Boxes have independent width/height/depth; spheres have a diameter. Transforms update collider data only on changes. Geometry is reused on resize and disposed on removal.
- Multiple box contact uses existing particle projection and triangle SAT in solver substeps. Spheres use capsule CCD with coincident endpoints. Existing single-box mode remains supported.
- Silk no longer uses the dense bump texture; wider sheen/specular highlights and moderate roughness reduce shimmer without temporal geometry smoothing or extra per-frame passes.

Validation: TypeScript and production build passed. Localization/solid lifecycle/multiple-box silk test passed; existing workspace contact and rotated-box/lighting tests passed. No remaining untranslated Russian literals found in the inspected UI and preset/workspace display strings. No browser visual QA was available; shimmer reduction needs confirmation on the user's device. Physically impossible initial intersections and extreme rapid edits are not guaranteed penetration-free.
