// Schema + validator for work/email_spec.json, the intermediate spec the
// design-email skill distills a brief into (Stage 1) before wireframing.
//
// Shape:
// {
//   brand: string,
//   campaign: string,
//   subject: string,                 // REQUIRED, verbatim from the brief
//   preheader?: string,               // include only if the brief gives one
//   layout: { width_px: number, margin_px: number, module_gap_px: number },
//   modules: Module[]                // top-to-bottom, 1+
// }
//
// Module = one of the shapes below, each carrying a shared `type` + `preset`:
//
//   header:      { type, preset, wordmark, nav?: [string, ...] }
//   hero:        { type, preset, headline, subhead?, eyebrow?, cta_text?, cta_link?, image_caption? }
//   offer_band:  { type, preset, headline, subtext?, legal?, cta_text?, cta_link? }
//   product_row: { type, preset, products: [ {name, price_now, price_was?, link?, image_caption?, badge?}, ... ] }  // 1-4 products
//   feature:     { type, preset, headline?, body?, cta_text?, cta_link?, image_caption? }
//   strip:       { type, preset, headline?, items?: [ {label, link?}, ... ] }
//   footer:      { type, preset, company?, address?, boilerplate?, links?: [string, ...] }

const MODULE_TYPES = ["header", "hero", "offer_band", "product_row", "feature", "strip", "footer"];

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function err(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function validateLayout(layout, errors) {
  const path = "layout";
  if (typeof layout !== "object" || layout === null) {
    err(errors, path, "must be an object with width_px, margin_px, module_gap_px");
    return;
  }
  for (const key of ["width_px", "margin_px", "module_gap_px"]) {
    if (typeof layout[key] !== "number" || layout[key] <= 0) {
      err(errors, `${path}.${key}`, "must be a positive number");
    }
  }
}

function validateProductRow(mod, path, errors) {
  if (!Array.isArray(mod.products) || mod.products.length < 1 || mod.products.length > 4) {
    err(errors, `${path}.products`, "must be an array of 1-4 products");
    return;
  }
  mod.products.forEach((p, i) => {
    const ppath = `${path}.products[${i}]`;
    if (!isNonEmptyString(p.name)) err(errors, `${ppath}.name`, "required, non-empty string");
    if (!isNonEmptyString(p.price_now)) err(errors, `${ppath}.price_now`, "required, non-empty string");
  });
}

function validateModule(mod, index, errors) {
  const path = `modules[${index}]`;
  if (typeof mod !== "object" || mod === null) {
    err(errors, path, "must be an object");
    return;
  }
  if (!MODULE_TYPES.includes(mod.type)) {
    err(errors, `${path}.type`, `must be one of ${MODULE_TYPES.join(", ")}`);
  }
  if (!isNonEmptyString(mod.preset)) {
    err(errors, `${path}.preset`, "required, non-empty string (named preset box from the library)");
  }

  switch (mod.type) {
    case "header":
      if (!isNonEmptyString(mod.wordmark)) err(errors, `${path}.wordmark`, "required, non-empty string");
      break;
    case "hero":
      if (!isNonEmptyString(mod.headline)) err(errors, `${path}.headline`, "required, non-empty string");
      break;
    case "offer_band":
      if (!isNonEmptyString(mod.headline)) err(errors, `${path}.headline`, "required, non-empty string");
      break;
    case "product_row":
      validateProductRow(mod, path, errors);
      break;
    case "feature":
      // headline/body are both optional individually, but at least one of them must carry content
      if (!isNonEmptyString(mod.headline) && !isNonEmptyString(mod.body)) {
        err(errors, path, "feature module needs a headline and/or body");
      }
      break;
    case "strip":
      if (mod.items !== undefined) {
        if (!Array.isArray(mod.items)) {
          err(errors, `${path}.items`, "must be an array when present");
        } else {
          mod.items.forEach((it, i) => {
            if (!isNonEmptyString(it.label)) err(errors, `${path}.items[${i}].label`, "required, non-empty string");
          });
        }
      }
      break;
    case "footer":
      // all fields optional; footer boilerplate commonly comes from the brand kit
      break;
    default:
      break;
  }
}

function validate(spec) {
  const errors = [];
  if (typeof spec !== "object" || spec === null) {
    return { valid: false, errors: ["spec must be a JSON object"] };
  }

  if (!isNonEmptyString(spec.brand)) err(errors, "brand", "required, non-empty string");
  if (!isNonEmptyString(spec.campaign)) err(errors, "campaign", "required, non-empty string");
  if (!isNonEmptyString(spec.subject)) err(errors, "subject", "required, non-empty string (verbatim from the brief)");
  if (spec.preheader !== undefined && !isNonEmptyString(spec.preheader)) {
    err(errors, "preheader", "must be a non-empty string when present");
  }

  validateLayout(spec.layout, errors);

  if (!Array.isArray(spec.modules) || spec.modules.length === 0) {
    err(errors, "modules", "must be a non-empty array");
  } else {
    spec.modules.forEach((mod, i) => validateModule(mod, i, errors));
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validate, MODULE_TYPES };
