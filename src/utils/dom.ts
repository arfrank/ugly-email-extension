// DOM manipulation utilities for Ugly Email

/**
 * Check if an element is eligible for tracking icon
 */
export function isEligible($el: JQuery): boolean {
  // Check if element already has tracking icon
  const hasIcon = $el.find('.ugly-email-track-icon').length > 0;
  return !hasIcon;
}

/**
 * Apply tracking icon to an email element
 */
export function applyIcons($el: JQuery, tracker: string): void {
  // Don't apply if not eligible
  if (!isEligible($el)) {
    return;
  }

  // Find the subject line element
  const subjectElement = $el.find('h2.hP, .bog span').first();
  if (subjectElement.length === 0) {
    return;
  }

  // Create tracking icon
  const img = document.createElement('img');
  img.src = 'data:image/svg+xml;utf8,<svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="eye" class="svg-inline--fa fa-eye fa-w-18" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M288 144a110.94 110.94 0 0 0-31.24 5 55.4 55.4 0 0 1 7.24 27 56 56 0 0 1-56 56 55.4 55.4 0 0 1-27-7.24A111.71 111.71 0 1 0 288 144zm284.52 97.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400c-98.65 0-189.09-55-237.93-144C98.91 167 189.34 112 288 112s189.09 55 237.93 144C477.1 345 386.66 400 288 400z"></path></svg>';
  img.className = 'ugly-email-track-icon';
  img.setAttribute('data-tooltip', tracker);
  img.title = `Tracked by ${tracker}`;
  // Add CSS styles inline for the icon
  img.style.cssText = `
    height: 16px;
    width: 16px;
    margin-right: 5px;
    vertical-align: middle;
    opacity: 0.7;
  `;

  // Prepend icon to subject
  subjectElement.prepend(img);
  // Mark element as checked
  $el.attr('data-ugly-checked', 'yes');
}

/**
 * Remove tracking icons from an element
 */
export function removeIcons($el: JQuery): void {
  $el.find('.ugly-email-track-icon').remove();
  $el.removeAttr('data-ugly-checked');
}

// Legacy functions for backward compatibility
export async function checkThread(): Promise<void> {
  // This function is no longer used but kept for compatibility
  return Promise.resolve();
}

export function checkList(): Promise<void[]> {
  // This function is no longer used but kept for compatibility
  return Promise.resolve([]);
}
