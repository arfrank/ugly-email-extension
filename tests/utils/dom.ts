import $ from 'jquery';
import * as dom from '../../src/utils/dom';

jest.mock('../../vendor/gmail-js', () => ({}));

describe('dom util', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('checks if element is eligible', () => {
    document.body.innerHTML = `
      <div class="test-element">
        <span class="ugly-email-track-icon">Already marked</span>
      </div>
    `;

    const $element = $('.test-element');
    expect(dom.isEligible($element)).toBe(false);
  });

  it('checks if element without icon is eligible', () => {
    document.body.innerHTML = `
      <div class="test-element">
        <span>Not marked</span>
      </div>
    `;

    const $element = $('.test-element');
    expect(dom.isEligible($element)).toBe(true);
  });

  it('applies tracking icon to element', () => {
    document.body.innerHTML = `
      <div class="test-element">
        <h2 class="hP">Subject</h2>
      </div>
    `;

    const $element = $('.test-element');
    dom.applyIcons($element, 'SendGrid');

    const icon = document.querySelector('.ugly-email-track-icon');
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute('data-tooltip')).toBe('SendGrid');
  });

  it('removes tracking icons', () => {
    document.body.innerHTML = `
      <div class="test-element" data-ugly-checked="yes">
        <span class="ugly-email-track-icon">Icon</span>
      </div>
    `;

    const $element = $('.test-element');
    dom.removeIcons($element);

    const icon = document.querySelector('.ugly-email-track-icon');
    expect(icon).toBeFalsy();
    expect($element.attr('data-ugly-checked')).toBeUndefined();
  });

  it('does not apply icon if element is not eligible', () => {
    document.body.innerHTML = `
      <div class="test-element">
        <span class="ugly-email-track-icon">Already has icon</span>
        <h2 class="hP">Subject</h2>
      </div>
    `;

    const $element = $('.test-element');
    dom.applyIcons($element, 'Mailchimp');

    const icons = document.querySelectorAll('.ugly-email-track-icon');
    expect(icons.length).toBe(1); // Should still only have one icon
  });
});
