import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { Link, type LinkProps } from 'react-router'
import { buttonStyles, type ButtonSize, type ButtonVariant } from './buttonStyles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and ignores clicks while the button's action is in progress. */
  pending?: boolean
}

// Cancelling the click also cancels a submit button's form submission, including the implicit
// click that pressing Enter in a text field sends to it.
const ignoreClick = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault()

export function Button({
  variant,
  size,
  pending = false,
  disabled,
  className,
  type = 'button',
  onClick,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      // A pending button is aria-disabled rather than disabled: disabling the focused button would
      // drop keyboard focus to <body>, so after "Register" the user would start over from the top.
      aria-disabled={pending || undefined}
      onClick={pending ? ignoreClick : onClick}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {pending && <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** A router link styled as a button, for actions that navigate. */
export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />
}
