// ==UserScript==
// @namespace     https://github.com/marktaiwan/
// @exclude       *
// @author        Marker

// ==UserLibrary==
// @name          Derpibooru Unified Userscript UI Utility
// @description   A simple userscript library for script authors to implement user-changeable settings on Derpibooru
// @license       MIT
// @version       1.0.3

// ==/UserScript==

// ==/UserLibrary==


// Workaround for:
//    Error parsing header X-XSS-Protection: 1; mode=block; report=https://derpibooru.report-uri.com/r/d/xss/enforce: reporting URL
//    is not same scheme, host, and port as page at character position 22. The default protections will be applied.
//
//    Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.
//
// This error occurs when script is executed inside an iframe, such as when the userscript didn't include the @noframes imperative.
if (window.self !== window.top) return;  // Exit when inside iframe

var ConfigManager = (function () {
  'use strict';

  const LIBRARY_NAME = 'Derpibooru Unified Userscript UI Utility';
  const LIBRARY_ID = 'derpi_four_u';
  const SETTINGS_PAGE = (document.querySelector('#js-setting-table') !== null);
  const SETTINGS_TAB_ID = 'userscript';
  const CSS = `
/*** This style is generated by ${LIBRARY_NAME} ***/
.${LIBRARY_ID}__container .block__header__item span {
  font-size: 14px;
  font-weight: bold;
}
.${LIBRARY_ID}--unsaved_warning {
  padding-top: 0px;
  padding-bottom: 0px;
  margin-top: -7px;
  border-top-width: 0px;
  opacity: 1;
  transition-property: opacity;
  transition-duration: 0.2s;
}
.${LIBRARY_ID}--unsaved_warning.${LIBRARY_ID}--hidden {
  opacity: 0;
}
.${LIBRARY_ID}--reset_button {
  font-size: 13px;
}
.${LIBRARY_ID}__container .block__subheader legend {
  font-size: 14px;
}
.${LIBRARY_ID}__section__description {
  padding-bottom: 8px;
}
.${LIBRARY_ID}__entry>input.input, .${LIBRARY_ID}__entry>select.input {
  padding: 2px 6px;
}
.${LIBRARY_ID}__entry input {
  vertical-align: middle;
}
.${LIBRARY_ID}__entry label {
  vertical-align: middle;
  margin-right: 4px;
}
.${LIBRARY_ID}__radio-button-container span {
  margin: 0px 4px;
}
.${LIBRARY_ID}__radio-button-container input {
  margin-right: 4px
}
`;

  // ==Util Functions==
  /** Modified from https://gist.github.com/MoOx/8614711
   * createElement() already taken, I dedicate this function name to Thesaurus.com
   */
  function composeElement(obj) {

    /** https://gist.github.com/youssman/745578062609e8acac9f
     * camelToDash('userId') => "user-id"
     */
    function camelToDash(str) {
      return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
    }

    let ele;

    if (obj.tag !== undefined) {
      ele = document.createElement(obj.tag);
      if (obj.attributes !== undefined) {
        for (const attr in obj.attributes) {
          if (obj.attributes.hasOwnProperty(attr)) {
            ele.setAttribute(camelToDash(attr), obj.attributes[attr]);
          }
        }
      }
    } else {
      ele = document.createDocumentFragment();
    }
    if (obj.html !== undefined) ele.innerHTML = obj.html;
    if (obj.text) ele.appendChild(document.createTextNode(obj.text));
    if (Array.isArray(obj.children)) {
      for (const child of obj.children) {
        ele.appendChild((child instanceof window.HTMLElement) ? child : composeElement(child));
      }
    }

    return ele;
  }

  function getQueryVariable(key) {
    let i;
    const array = window.location.search.substring(1).split('&');

    for (i = 0; i < array.length; i++) {
      if (key == array[i].split('=')[0]) return array[i].split('=')[1];
    }
  }

  // ==!Util Functions==


  function validateIdentifier(string) {
    if (!(/^(?=[^\d])(?=\w)[a-zA-Z\d_-]+$/).test(string)) {
      throw Error(`"${string}" is not a valid identifier`);
    }
  }

  // function takes in an array of required property names
  // and throws exception if any of them is undefined in obj
  function validateParameters(requiredParams, obj) {
    const array = [];

    for (const param of requiredParams) {
      if (obj[param] === undefined) {
        array.push(param);
      }
      // additional dependency for radio and dropdown input type
      if ((param == 'radio' || param == 'dropdown') &&
        (obj.selections === undefined || obj.selections.length <= 0)) {
          array.push('selections');
      }
    }

    if (array.length > 0) {
      throw {type: 'missing params', arr: array, o: obj};
    }
  }

  function initStorage() {
    if (!localStorage.getItem(LIBRARY_ID)) {
      const storage = {};
      storage[LIBRARY_ID] = {};
      setStorage(storage);
    }
  }

  function getStorage() {
    return JSON.parse(localStorage.getItem(LIBRARY_ID));
  }

  function setStorage(obj) {
    localStorage.setItem(LIBRARY_ID, JSON.stringify(obj));
  }

  function storeSettings(scriptId, key, value) {
    const storage = getStorage();
    storage[scriptId][key] = value;
    setStorage(storage);
  }

  function retrieveSettings(scriptId, key) {
    const storage = getStorage();
    return storage[scriptId][key];
  }

  /**
   * Display warning when one or more inputs had been changed.
   */
  function checkForUnsavedChanges() {
    const storage = getStorage();
    const userscriptTabContent = document.querySelector(`[data-tab="${SETTINGS_TAB_ID}"]`);
    const scriptContainers = userscriptTabContent.querySelectorAll('[data-script-id]');
    const warningBanner = document.querySelector(`.${LIBRARY_ID}--unsaved_warning`);
    let unsaved_changes = false;

    for (const container of scriptContainers) {
      const scriptId = container.dataset.scriptId;
      const inputElements = container.querySelectorAll('[data-entry-key]');

      for (const input of inputElements) {
        const key = input.dataset.entryKey;
        const propType = input.dataset.entryPropertyType;
        const storedValue = storage[scriptId][key];

        if (input[propType] !== storedValue) {
          unsaved_changes = true;
          break; // break out of loop early
        }
      }
      if (unsaved_changes) {
        break;
      }
    }

    if (unsaved_changes) {
      warningBanner.classList.remove(`${LIBRARY_ID}--hidden`);
    } else {
      warningBanner.classList.add(`${LIBRARY_ID}--hidden`);
    }
  }

  function bindSaveHandler(saveBtn) {
    saveBtn.addEventListener('click', function () {
      const storage = getStorage();
      const userscriptTabContent = document.querySelector(`[data-tab="${SETTINGS_TAB_ID}"]`);
      const scriptContainers = userscriptTabContent.querySelectorAll('[data-script-id]');

      for (const container of scriptContainers) {
        const scriptId = container.dataset.scriptId;
        const inputElements = container.querySelectorAll('[data-entry-key]');

        for (const input of inputElements) {
          const key = input.dataset.entryKey;
          const propType = input.dataset.entryPropertyType;
          const inputValue = input[propType];

          storage[scriptId][key] = inputValue;
        }
      }
      setStorage(storage);
    });
  }

  function bindResetHandler(resetBtn) {
    resetBtn.addEventListener('click', function (e) {
      e.preventDefault();

      const btn = e.target;
      const scriptId = btn.dataset.scriptId;
      let selector = '[data-default-value]';

      // modify selector to target only a single script container
      if (resetBtn.parentElement.dataset.resetAll !== '1') {
        selector = `.${LIBRARY_ID}__container[data-script-id="${scriptId}"] ${selector}`;
      }

      const userscriptTabContent = document.querySelector(`[data-tab="${SETTINGS_TAB_ID}"]`);
      const inputs = userscriptTabContent.querySelectorAll(selector);
      for (const input of inputs) {
        const propType = input.dataset.entryPropertyType;
        let defaultValue = input.dataset.defaultValue;

        //  input[type="checkbox"] accepts boolean values, but data-default-value stores 'true' 'false' strings.
        if (propType == 'checked') {
          defaultValue = (defaultValue == 'true');
        }
        //  input[type="number"] uses valueAsNumber property for reading and storing values.
        if (propType == 'valueAsNumber') {
          defaultValue = Number.parseFloat(defaultValue);
        }

        input[propType] = defaultValue;
      }
      checkForUnsavedChanges();
    });
  }

  function initSettingsTab() {
    const userscriptTabContent = document.querySelector(`[data-tab="${SETTINGS_TAB_ID}"]`);
    const settingTable = document.querySelector('#js-setting-table');
    let ele;

    if (!SETTINGS_PAGE || userscriptTabContent !== null) {
      return;
    }

    GM_addStyle(CSS);

    // Create tab
    ele = composeElement({
      tag: 'a',
      attributes: {dataClickTab: SETTINGS_TAB_ID, href: '#'},
      text: 'Userscript'
    });
    settingTable.querySelector('.block__header--js-tabbed').appendChild(ele);

    // Create tab content
    ele = composeElement({
      tag: 'div',
      attributes: {class: 'block__tab hidden', dataTab: SETTINGS_TAB_ID},
      children: [{
        tag: 'div',
        attributes: {class: 'block block--fixed block--primary flex'},
        children: [{
          tag: 'span',
          text: 'Settings on this tab are managed by installed userscripts and stored locally.'
        },{
          tag: 'div',
          attributes: {class: `flex__right ${LIBRARY_ID}--reset_button`, dataResetAll: '1'},
          children: [{
            tag: 'a',
            attributes: {href: '#'},
            text: 'Reset all settings'
          }]
        }]
      },{
        tag: 'div',
        attributes: {
          class: `block block--fixed block--warning ${LIBRARY_ID}--unsaved_warning ${LIBRARY_ID}--hidden`
        },
        text: 'You have unsaved changes.'
      }]
    });

    bindSaveHandler(document.querySelector('[action="/update_settings"] input[name="commit"]'));
    bindResetHandler(ele.querySelector(`.${LIBRARY_ID}--reset_button>a`));

    // Insert the tab element after the last existing tab, but before the 'Save settings' button
    settingTable.querySelector('.block__tab:last-of-type').insertAdjacentElement('afterend', ele);

    // Auto focus on tab if link is of the format "https://derpibooru.org/settings?active_tab=userscript"
    try {
      const activeTabId = getQueryVariable('active_tab');
      if (activeTabId !== undefined) {
        const activeTab = settingTable.querySelector(`[data-click-tab=${activeTabId}]`);
        const activeTabContent = settingTable.querySelector(`[data-tab=${activeTabId}]`);
        const visibleTab = settingTable.querySelector('.selected[data-click-tab]');
        const visibleTabContent = settingTable.querySelector('[data-tab]:not(.hidden)');

        if ([activeTab, activeTabContent, visibleTab, visibleTabContent].some(ele => ele === null)) {
          throw 'Missing tab element';
        }

        visibleTab.classList.remove('selected');
        visibleTabContent.classList.add('hidden');
        activeTab.classList.add('selected');
        activeTabContent.classList.remove('hidden');
      }
    } catch (e) {
      console.log(e);
    }
    return ele;
  }

  function appendScriptContainer(name, id, description) {
    const userscriptTabContent = document.querySelector(`[data-tab="${SETTINGS_TAB_ID}"]`);
    const ele = composeElement({
      tag: 'div',
      attributes: {class: `block ${LIBRARY_ID}__container`, dataScriptId: id},
      children: [{
        tag: 'div',
        attributes: {class: 'block__header block__header__item flex'},
        children: [{
          tag: 'span',
          text: name
        },{
          tag: 'div',
          attributes: {class: `flex__right ${LIBRARY_ID}--reset_button`, dataResetAll: '0'},
          children: [{
            tag: 'a',
            attributes: {href: '#', dataScriptId: id},
            text: 'Default'
          }]
        }]
      }, {
        tag: 'div',
        attributes: {class: 'block__content'}
      }]
    });
    bindResetHandler(ele.querySelector(`.${LIBRARY_ID}--reset_button>a`));

    appendDescription(ele.lastChild, description);
    ele.addEventListener('change', checkForUnsavedChanges); // attach handler to show warning when input value changed

    return userscriptTabContent.appendChild(ele).lastChild;
  }

  function appendFieldset(name, id, description, parent) {
    const ele = composeElement({
      tag: 'fieldset',
      attributes: {class: `field ${LIBRARY_ID}__subheader`, dataFieldId: id},
      children: [{
        tag: 'legend',
        text: name
      }]
    });
    appendDescription(ele, description);
    return parent.appendChild(ele);
  }

  function appendDescription(node, string) {
    if (string === undefined) return;

    const ele = composeElement({
      tag: 'div',
      attributes: {class: 'fieldlabel'},
      children: [{
        tag: 'i',
        text: string
      }]
    });

    // Headers and subheaders require additional styling, add class for CSS to target
    if ((node.parentElement && node.parentElement.classList.contains(`${LIBRARY_ID}__container`)) ||
      node.classList.contains(`${LIBRARY_ID}__subheader`)) {
        ele.classList.add(`${LIBRARY_ID}__section__description`);
    }

    return node.appendChild(ele);
  }

  function ConfigManager(scriptName, scriptId, scriptDescription) {
    validateIdentifier(scriptId);

    const config = new ConfigObject(scriptName, scriptId, scriptId, null, scriptDescription, appendScriptContainer);
    const storage = getStorage();
    // initialize key in setting storage
    if (storage[scriptId] === undefined) {
      storage[scriptId] = {};
      setStorage(storage);
    }
    return Object.freeze(config);
  }

  function ConfigObject(title, id, scriptId, parent, description, appendFn) {
    validateIdentifier(id);
    this.title = title;
    this.id = id;
    this.description = description;
    this.scriptId = scriptId;
    this.pageElement = (SETTINGS_PAGE) ? appendFn(title, id, description, parent) : null;
    this.parentElement = parent;
  }

  ConfigObject.prototype.addFieldset = function (title, id, fieldDescription) {
    return Object.freeze(
      new ConfigObject(title, id, this.scriptId, this.pageElement, fieldDescription, appendFieldset)
    );
  };

  ConfigObject.prototype.registerSetting = function (entryConfig) {
    try {
      validateParameters(['title', 'key', 'type', 'defaultValue'], entryConfig);
      const {title: entryTitle, key: entryKey, type, defaultValue, description, selections} = entryConfig;
      const scriptId = this.scriptId;
      let storedValue = retrieveSettings(scriptId, entryKey);
      if (storedValue === undefined) {
        storeSettings(scriptId, entryKey, defaultValue); // initialize key into storage
        storedValue = defaultValue;
      }

      /**
       * Basic workflow:
       *   - Build elements in memory
       *   - Display <input> elements based on storedValue
       *   - Attach elements to page
       */
      // prefix the element id and classes to minimize chance of conflict
      const namespacedKey = `${scriptId}__${entryKey.replace(/\s/g,'')}`;
      // entry container is common for all input types
      const ele = composeElement({
        tag: 'div',
        attributes: {class: `field ${LIBRARY_ID}__entry`, dataEntryId: namespacedKey}
      });
      switch (type) {
        case 'checkbox': {
          ele.appendChild(composeElement({
            children: [{
              tag: 'label',
              text: entryTitle,
              attributes: {for: namespacedKey}
            },{
              tag: 'input',
              attributes: {
                id: namespacedKey,
                type: 'checkbox',
                dataDefaultValue: defaultValue,
                dataEntryKey: entryKey,
                dataEntryPropertyType: 'checked'
              }
            }]
          }));
          break;
        }
        case 'text': {
          ele.appendChild(composeElement({
            children: [{
              tag: 'label',
              text: entryTitle,
              attributes: {for: namespacedKey}
            },{
              tag: 'input',
              attributes: {
                class: 'input',
                id: namespacedKey,
                type: 'text',
                autocomplete: 'off',
                dataDefaultValue: defaultValue,
                dataEntryKey: entryKey,
                dataEntryPropertyType: 'value'
              }
            }]
          }));
          break;
        }
        case 'number': {
          ele.appendChild(composeElement({
            children: [{
              tag: 'label',
              text: entryTitle,
              attributes: {for: namespacedKey}
            },{
              tag: 'input',
              attributes: {
                class: 'input',
                id: namespacedKey,
                type: 'number',
                dataDefaultValue: defaultValue,
                dataEntryKey: entryKey,
                dataEntryPropertyType: 'valueAsNumber'
              }
            }]
          }));
          break;
        }
        case 'radio': {
          ele.appendChild(composeElement({
            tag: 'label',
            text: entryTitle
          }));
          // Append radio buttons
          const buttonSet = ele.appendChild(composeElement({
            tag: 'span',
            attributes: {
              class: `${LIBRARY_ID}__radio-button-container`,
              dataDefaultValue: defaultValue,
              dataEntryKey: entryKey,
              dataEntryPropertyType: 'value'
            }
          }));

          /**
           *  Radio buttons behaves like checkboxes except that only one can be
           *  selected at a time, we make them act more like dropdown lists by assigning
           *  setter and getter to their containers to emulate the 'value' property
           */
          Object.defineProperty(buttonSet, 'value', {
            get: function () {
              return this.querySelector('input:checked').value;
            },
            set: function (val) {
              this.querySelector(`input[value="${val}"]`).checked = true;
            }
          });
          let n = 1;
          for (const selection of selections) {
            const selectionId = namespacedKey + '-' + n;  // Generate unique ID for each radio button
            n = n + 1;
            const span = composeElement({
              tag: 'span',
              children: [{
                tag: 'input',
                attributes: {
                  type: 'radio',
                  name: namespacedKey,
                  id: selectionId,
                  value: selection.value
                }
              }, {
                tag: 'label',
                attributes: {for: selectionId},
                text: selection.text
              }]
            });
            buttonSet.appendChild(span);
          }
          break;
        }
        case 'dropdown': {
          ele.appendChild(composeElement({
            tag: 'label',
            attributes: {for: namespacedKey},
            text: entryTitle
          }));
          // Append dropdown
          const selectElement = ele.appendChild(composeElement({
            tag: 'select',
            attributes: {
              class: `input ${LIBRARY_ID}__dropdown-list`,
              id: namespacedKey,
              dataDefaultValue: defaultValue,
              dataEntryKey: entryKey,
              dataEntryPropertyType: 'value'
            }
          }));
          for (const selection of selections) {
            selectElement.appendChild(composeElement({
              tag: 'option',
              attributes: {value: selection.value},
              text: selection.text
            }));
          }
          break;
        }
        default: {
          throw Error(`'${type}' does not match any supported input types`);
        }
      }
      appendDescription(ele, description);
      const inputElement = ele.querySelector('[data-default-value]');
      const propType = inputElement.dataset.entryPropertyType;
      inputElement[propType] = storedValue;

      return SETTINGS_PAGE ? this.pageElement.appendChild(ele) : ele;
    } catch (e) {
      // log the error
      if (e.type == 'missing params') {
        console.error(`Missing the following required parameters:\n\t[${e.arr.join(', ')}]\nin object:\n`, e.o);
      } else {
        console.error(e);
      }
    }
  };

  ConfigObject.prototype.setEntry = function (key, value) {
    storeSettings(this.scriptId, key, value);
  };

  ConfigObject.prototype.getEntry = function (key) {
    return retrieveSettings(this.scriptId, key);
  };

  ConfigObject.prototype.deleteEntry = function (key) {
    const storage = getStorage();
    const scriptId = this.scriptId;
    delete storage[scriptId][key];
    setStorage(storage);
  };

  initStorage();
  initSettingsTab();
  return ConfigManager;
})();
