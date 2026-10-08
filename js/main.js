/* Honey Ventures — site behaviour (no dependencies). */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * Mobile menu (Astra-style dropdown below the header, ≤ 921px)
   * ------------------------------------------------------------------- */
  var toggle = document.querySelector('.menu-toggle');
  var mobileMenu = document.getElementById('mobile-menu');

  function setMenu(open) {
    if (!toggle || !mobileMenu) return;
    toggle.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('is-open', open);
  }

  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.mobile-header')) setMenu(false);
    });
    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    window.matchMedia('(min-width: 922px)').addEventListener('change', function (mq) {
      if (mq.matches) setMenu(false);
    });
  }

  /* ---------------------------------------------------------------------
   * FAQ accordion — one panel open at a time, first open by default
   * (matches the Elementor accordion on the live site).
   * ------------------------------------------------------------------- */
  document.querySelectorAll('[data-accordion]').forEach(function (accordion) {
    var triggers = Array.prototype.slice.call(accordion.querySelectorAll('.accordion-trigger'));

    function setOpen(trigger, open) {
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      trigger.setAttribute('aria-expanded', String(open));
      if (panel) panel.classList.toggle('is-open', open);
    }

    triggers.forEach(function (trigger, index) {
      trigger.addEventListener('click', function () {
        var willOpen = trigger.getAttribute('aria-expanded') !== 'true';
        triggers.forEach(function (t) { setOpen(t, false); });
        setOpen(trigger, willOpen);
      });
      trigger.addEventListener('keydown', function (e) {
        var next;
        if (e.key === 'ArrowDown') next = triggers[(index + 1) % triggers.length];
        else if (e.key === 'ArrowUp') next = triggers[(index - 1 + triggers.length) % triggers.length];
        else if (e.key === 'Home') next = triggers[0];
        else if (e.key === 'End') next = triggers[triggers.length - 1];
        if (next) { e.preventDefault(); next.focus(); }
      });
    });
  });

  /* ---------------------------------------------------------------------
   * Smooth scrolling for in-page links (CSS handles most browsers; this
   * also moves focus to the target for keyboard users).
   * ------------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var id = link.getAttribute('href').slice(1);
    var target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    history.replaceState(null, '', '#' + id);
  });

  /* ---------------------------------------------------------------------
   * Form validation helpers
   * Messages are the ones SureForms uses on the live site.
   * ------------------------------------------------------------------- */
  var MSG_REQUIRED = 'This field is required.';
  var MSG_EMAIL = 'Enter a valid email address.';
  var MSG_PHONE = 'Enter a valid phone number.';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldWrap(field) {
    return field.closest('.form-field, .form-group');
  }

  function errorEl(field) {
    var id = field.getAttribute('aria-describedby');
    var el = id && document.getElementById(id);
    if (el) return el;
    var wrap = fieldWrap(field);
    if (!wrap) return null;
    el = wrap.querySelector('.field-error');
    if (!el) {
      el = document.createElement('span');
      el.className = 'field-error';
      el.id = (field.id || field.name) + '-error';
      el.setAttribute('aria-live', 'polite');
      wrap.appendChild(el);
      field.setAttribute('aria-describedby', el.id);
    }
    return el;
  }

  function validateField(field) {
    var value = field.value.trim();
    var message = '';
    if (field.required && !value) message = MSG_REQUIRED;
    else if (value && field.type === 'email' && !EMAIL_RE.test(value)) message = MSG_EMAIL;
    else if (value && field.type === 'tel' && !/^[+()\d\s-]{7,20}$/.test(value)) message = MSG_PHONE;

    var wrap = fieldWrap(field);
    var err = errorEl(field);
    if (wrap) wrap.classList.toggle('has-error', !!message);
    if (err) err.textContent = message;
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    return !message;
  }

  function validateForm(form) {
    var fields = form.querySelectorAll('input:not([type="hidden"]), textarea, select');
    var firstInvalid = null;
    fields.forEach(function (field) {
      if (!validateField(field) && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function bindLiveValidation(form) {
    form.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(function (field) {
      field.addEventListener('blur', function () { if (field.value) validateField(field); });
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') validateField(field);
      });
    });
  }

  function setStatus(form, type, text, html) {
    var status = form.querySelector('.form-status');
    if (!status) return;
    status.className = 'form-status' + (type ? ' is-' + type : '');
    if (html) status.innerHTML = html; else status.textContent = text || '';
  }

  /* ---------------------------------------------------------------------
   * Homepage "Request a Quote" form → existing SureForms REST endpoint
   * (POST multipart/form-data + X-WP-Submit-Token header, exactly as the
   * live site's formSubmit.js does). Success is only shown when the API
   * confirms it.
   * ------------------------------------------------------------------- */
  document.querySelectorAll('form.js-sureform').forEach(function (form) {
    bindLiveValidation(form);
    var button = form.querySelector('[type="submit"]');
    var label = button ? button.textContent : '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setStatus(form, '', '');
      if (!validateForm(form)) return;

      var payload = new FormData();
      new FormData(form).forEach(function (value, key) { payload.append(key, value); });

      if (button) { button.disabled = true; button.textContent = 'Sending…'; }

      fetch(form.action, {
        method: 'POST',
        body: payload,
        headers: { 'X-WP-Submit-Token': form.getAttribute('data-submit-token') || '' }
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = null;
            try { data = JSON.parse(text); } catch (err) { /* non-JSON response */ }
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          var data = result.data || {};
          if (result.ok && data.success !== false && result.data) {
            var message = (data.data && data.data.message) || data.message || '';
            form.reset();
            form.querySelectorAll('.has-error').forEach(function (el) { el.classList.remove('has-error'); });
            // SureForms returns the confirmation as HTML; render it as text.
            var tmp = document.createElement('div');
            tmp.innerHTML = message;
            setStatus(form, 'success', tmp.textContent.trim() || 'Your message has been sent.');
            return;
          }
          var fieldErrors = data.data && data.data.field_errors;
          if (fieldErrors) {
            Object.keys(fieldErrors).forEach(function (name) {
              var field = form.querySelector('[name="' + name + '"]');
              if (!field) return;
              var wrap = fieldWrap(field);
              var err = errorEl(field);
              if (wrap) wrap.classList.add('has-error');
              if (err) err.textContent = String(fieldErrors[name]);
              field.setAttribute('aria-invalid', 'true');
            });
          }
          setStatus(form, 'error', 'There was an error trying to submit your form. Please try again.');
        })
        .catch(function () {
          setStatus(form, 'error', 'There was an error trying to submit your form. Please try again.');
        })
        .then(function () {
          if (button) { button.disabled = false; button.textContent = label; }
        });
    });
  });

  /* ---------------------------------------------------------------------
   * "Get A Free Quote" form (contact.html).
   * On the live site this form posts to mail.php, which does not exist
   * (the request is rejected), so there is no working backend to keep.
   * Set data-endpoint on the form to a real handler to enable sending;
   * until then we validate and tell the visitor how to reach the team,
   * rather than pretending the request was sent.
   * ------------------------------------------------------------------- */
  document.querySelectorAll('form.js-quote-form').forEach(function (form) {
    bindLiveValidation(form);
    var button = form.querySelector('[type="submit"]');
    var label = button ? button.textContent : '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setStatus(form, '', '');
      if (!validateForm(form)) return;

      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) {
        setStatus(form, 'info', '', 'Online submission isn’t available yet. Please call <a href="tel:+919880902002">+91 98809 02002</a> or <a href="https://wa.me/919880902002" target="_blank" rel="noopener">chat on WhatsApp</a> and our team will help you right away.');
        return;
      }

      if (button) { button.disabled = true; button.textContent = 'Sending…'; }
      fetch(endpoint, { method: 'POST', body: new FormData(form) })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          form.reset();
          setStatus(form, 'success', 'Thank you! Our team will contact you shortly.');
        })
        .catch(function () {
          setStatus(form, 'error', 'There was an error trying to submit your form. Please try again.');
        })
        .then(function () {
          if (button) { button.disabled = false; button.textContent = label; }
        });
    });
  });
})();
