import { forwardRef, type AnchorHTMLAttributes } from "react";
import { navigate } from "./router";

const Link = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; scroll?: boolean; prefetch?: boolean }>(({ href, onClick, scroll: _s, prefetch: _p, ...rest }, ref) => (
  <a
    ref={ref}
    href={`#${href}`}
    onClick={(e) => {
      onClick?.(e);
      if (!e.defaultPrevented) {
        e.preventDefault();
        navigate(href);
      }
    }}
    {...rest}
  />
));
export default Link;
