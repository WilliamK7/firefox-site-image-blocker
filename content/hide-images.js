const ROOT_ATTRIBUTE = "data-site-image-blocker";
const ROOT_ATTRIBUTE_VALUE = "on";
const STYLE_ID = "site-image-blocker-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = STYLE_ID;
  styleElement.textContent = `
    html[${ROOT_ATTRIBUTE}="${ROOT_ATTRIBUTE_VALUE}"] img,
    html[${ROOT_ATTRIBUTE}="${ROOT_ATTRIBUTE_VALUE}"] picture,
    html[${ROOT_ATTRIBUTE}="${ROOT_ATTRIBUTE_VALUE}"] svg image,
    html[${ROOT_ATTRIBUTE}="${ROOT_ATTRIBUTE_VALUE}"] input[type="image"] {
      display: none !important;
    }

    html[${ROOT_ATTRIBUTE}="${ROOT_ATTRIBUTE_VALUE}"] [style*="background-image"] {
      background-image: none !important;
    }
  `;

  const appendStyle = () => {
    const parentNode = document.head || document.documentElement;

    if (!parentNode) {
      return false;
    }

    parentNode.appendChild(styleElement);
    return true;
  };

  if (appendStyle()) {
    return;
  }

  document.addEventListener(
    "readystatechange",
    function handleReadyState() {
      if (!appendStyle()) {
        return;
      }

      document.removeEventListener("readystatechange", handleReadyState);
    },
    { once: false }
  );
}

function setBlockState(active) {
  const applyState = () => {
    if (!document.documentElement) {
      return false;
    }

    if (active) {
      ensureStyle();
      document.documentElement.setAttribute(
        ROOT_ATTRIBUTE,
        ROOT_ATTRIBUTE_VALUE
      );
    } else {
      document.documentElement.removeAttribute(ROOT_ATTRIBUTE);
    }

    return true;
  };

  if (applyState()) {
    return;
  }

  document.addEventListener(
    "readystatechange",
    function handleReadyState() {
      if (!applyState()) {
        return;
      }

      document.removeEventListener("readystatechange", handleReadyState);
    },
    { once: false }
  );
}

setBlockState(true);
