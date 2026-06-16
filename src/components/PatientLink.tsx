import { Link, LinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

type Props = Omit<LinkProps, "to"> & {
  patientId: string;
  children: React.ReactNode;
  className?: string;
};

/** Consistent teal hyperlink for any patient name across the app. */
export default function PatientLink({ patientId, children, className, onClick, ...rest }: Props) {
  return (
    <Link
      to={`/patients/${patientId}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        "text-[#1D9E75] hover:underline cursor-pointer font-medium",
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}
