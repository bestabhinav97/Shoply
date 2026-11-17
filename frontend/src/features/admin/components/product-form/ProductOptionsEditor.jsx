import { Input } from "../../../../components/ui/Input";
import { Button } from "../../../../components/ui/Button";

export function ProductOptionsEditor({
  options,
  variants,
  onChange,
  disabled,
}) {
  const changeOption = (index, value) =>
    onChange(options.map((item, i) => (i === index ? value : item)));
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">Selectable options</legend>
      <h3>Selectable options</h3>
      <p>
        No options means one default variant. Only combinations you add below
        are sold.
      </p>
      {options.map((option, index) => (
        <fieldset key={option.id}>
          <legend className="sr-only">Option {index + 1}</legend>
          <h3>Option {index + 1}</h3>
          <Input
            label={`Option ${index + 1} name`}
            required
            maxLength={100}
            value={option.name}
            onChange={(e) =>
              changeOption(index, { ...option, name: e.target.value })
            }
          />
          {option.values.map((value, vi) => (
            <div className="editor-row" key={value.id}>
              <Input
                label={`Option ${index + 1} value ${vi + 1}`}
                required
                maxLength={100}
                value={value.value}
                onChange={(e) =>
                  changeOption(index, {
                    ...option,
                    values: option.values.map((v, i) =>
                      i === vi ? { ...v, value: e.target.value } : v,
                    ),
                  })
                }
              />
              <Button
                disabled={variants.some((v) =>
                  v.optionValueIds.includes(value.id),
                )}
                onClick={() =>
                  changeOption(index, {
                    ...option,
                    values: option.values.filter((v) => v.id !== value.id),
                  })
                }
              >
                Remove value {vi + 1}
              </Button>
            </div>
          ))}
          <Button
            disabled={option.values.length >= 100}
            onClick={() =>
              changeOption(index, {
                ...option,
                values: [
                  ...option.values,
                  { id: crypto.randomUUID(), value: "" },
                ],
              })
            }
          >
            Add value to option {index + 1}
          </Button>
          <Button
            disabled={variants.some((v) =>
              v.optionValueIds.some((id) =>
                option.values.some((ov) => ov.id === id),
              ),
            )}
            onClick={() => onChange(options.filter((o) => o.id !== option.id))}
          >
            Remove option {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        disabled={options.length >= 8}
        onClick={() =>
          onChange([
            ...options,
            {
              id: crypto.randomUUID(),
              name: "",
              values: [{ id: crypto.randomUUID(), value: "" }],
            },
          ])
        }
      >
        Add option
      </Button>
    </fieldset>
  );
}
