# Guest dosing goals — v6.65.1

Guest goals are pH 7.4 and FC 7.5 ppm. Private config stores these separately as
`targets.guest_ph_target` and `targets.guest_fc_target_ppm`; owner calculator
targets, chart bounds, actual doses, measurements and invitation caps are unchanged.
Service → Guest invitations → Guest dosing goals edits and syncs both leaf values
with conflict protection. Instructions and real-data practice display/use them.

The acid endpoint goal is distinct from eligibility: the conservative strip lower
working boundary still must exceed 7.8 before suggesting acid. A 7.8 strip block
does not by itself justify dosing to 7.4. Each step remains partial, capped at
1 ppm TA consumption and the existing TA floor and invitation limits, with a fresh
test after mixing before another suggestion. No exact pH endpoint is promised.

Older configs with an explicit shared FC target retain it unless the separate
guest override is present. Configs without either FC setting default to 7.5 ppm.
