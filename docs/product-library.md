# Product library · 6.49

Service → Products & calculator defaults manages products. The dose dropdown also has Add new product; saving there returns to the dose row with the new product selected. Default products for liquid chlorine, dry acid and baking soda are saved separately. Adding a product does not automatically make it the calculator default or log a dose.

## Persistence and identity

- `config.products[id]`: product profile with `schema_version: 1`, stable `id`, integer `revision`, `name`, `manufacturer`, `family`, `form`, optional concentration/density, source text/link, notes, archive state and update time.
- `config.product_defaults`: profile IDs for `bleach`, `acid`, `baking`.
- New doses retain their original amount/unit plus `product_id`, `product_revision`, and a complete `product_profile` snapshot. Drafts freeze that snapshot when selected. Editing the catalogue never changes it.
- Existing records are not migrated or rewritten. Built-in reference profiles preserve their earlier numerical assumptions and expose Copy rather than Edit. Legacy records continue through the legacy conversion paths.
- Custom edits create a new revision, not changes to old snapshots. Product-specific corrections group by ID/revision rather than display name. Legacy references retain legacy calibration groups. Theoretical chemistry can share physical constants; empirical dose corrections do not transfer between custom product revisions.
- Product identity is read-only during correction of a profiled dose. Amount/unit/time corrections preserve its original snapshot. To replace the actual chemical identity, remove the incorrect entry and log the correct product.

Profile saves cache immediately and queue only changed profiles/defaults. Authenticated `/api/config` sync merges into the latest remote configuration, uses SHA-conflict retries and refuses unresolved same-product revision conflicts. Copy can create a separate profile for conflicting edits. Pending data survives reload and retries on connect, manual Sync, online and foreground events. Settings-only saves do not create chemistry events. New-fill and service-settings saves preserve unrelated remote product entries. Existing OAuth, CSRF, file-size limits and private GitHub storage remain unchanged; no Worker deployment is required for these additive fields. No automatic label-document downloads or image uploads occur.

## Inputs and conversion

The chemical family identifies the supported active ingredient, not its brand. User-entered concentrations and density/source information are not independently verified.

Liquid chlorine accepts active NaOCl weight %, available-Cl₂ weight %, available-Cl₂ g/L, or trade %. These are distinct bases. Weight-based concentrations require density to recommend a liquid-volume dose; available g/L and trade % do not. Active NaOCl mass is converted to available Cl₂ using 70.906/74.442. The existing 7.5% bleach reference retains the old 1.49-ppm-per-US-fl-oz/395-gallon conversion; it is explicitly marked as an existing reference with unverified concentration basis, not newly verified density data. See [Olin sodium hypochlorite manual](https://olinchloralkali.com/wp-content/uploads/2023/10/102-00553-0424-Olin-Sodium-Hypochlorite-PSM.pdf).

Sodium bisulfate, sodium bicarbonate, dichlor dihydrate and boric acid use active-ingredient weight %. Dry-acid Taylor recommendations scale the existing 93.2% reference table to the selected purity; the existing nonlinear carbonate/borate/CYA model handles the logged response. Bicarbonate recommendations start from pure active mass, then correct for product purity. Dichlor supplies calculated CYA and FC. Boric acid updates the borate inventory. No missing chemistry measurements are inferred.

Density supports g/mL, g/L, kg/L, lb/US gal, weight oz/US fl oz, approximate specific gravity (water ≈1 g/mL), or a measured weight/volume pair. Weight units: g, kg, weight oz, lb. Volume units: mL, L, US tsp/tbsp/cup/fl oz. Internally density is evaluated as g/mL. For powders/granules this must be bulk/loose-product density or a measured scoop conversion, not crystal density. Raw entered units are retained in the profile and its snapshots. Weight and volume are never silently interchanged when density is missing.

## Restrictions

- Missing concentration: log only. Missing solid density: weight calculations can work, but spoon/cup recommendations are withheld. Unknown liquid density: volume FC calculations are withheld for weight-% bases.
- Other/unknown formulations and calcium products remain log-only. There is no new CH dose calculator. Use Other for blends, enhanced sanitizers or unlisted hydration forms; the dichlor model specifically supports dihydrate.
- Hydrochloric/muriatic acid can be recorded for history but is not a calculator default or supported projection input for this spa. [Jacuzzi advises against it](https://www.jacuzzi.com/en-ca/How-to-Lower-Alkalinity-in-Hot-Tub.html).
- Unsupported additions pause affected forecasts instead of pretending their effect is zero. A subsequent measured sample can reset the forecast normally.
- Archive hides a product from new choices; snapshots and historical records remain intact. Archiving a selected default does not silently substitute another chemical; the calculator asks for an active default.
- This is not a product compatibility certification, an instruction to use a chemical, or a guarantee of its actual strength. Follow spa/product directions. Bleach aging, packing variation, label rounding and unlogged activity remain uncertainty sources. Product-specific response corrections refine from later eligible samples without changing label properties.

Client validation restricts chemistry types, concentration bases/ranges, positive density ratios, IDs/revisions and text/source lengths. Built-in references cannot be overwritten. Up to 100 custom profiles are supported within a 90KB client config budget (the Worker caps config at 100KB). Oversized or conflicted saves remain explicit errors/pending; original data is preserved.
