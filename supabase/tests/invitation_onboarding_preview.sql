-- Regression coverage for the authenticated invitation onboarding preview RPC.
begin;

do $test$
declare
  v_function regprocedure := 'public.get_invitation_onboarding_preview(text)'::regprocedure;
  v_security_definer boolean;
  v_volatility "char";
  v_definition text;
begin
  select p.prosecdef, p.provolatile, pg_get_functiondef(p.oid)
    into v_security_definer, v_volatility, v_definition
    from pg_proc p
   where p.oid = v_function;

  assert v_security_definer, 'invitation preview must run as a controlled security-definer function';
  assert v_volatility = 's', 'invitation preview must remain stable';
  assert has_function_privilege('authenticated', v_function, 'EXECUTE'),
    'authenticated users need the onboarding preview RPC';
  assert not has_function_privilege('anon', v_function, 'EXECUTE'),
    'anonymous users must not receive startup IDs through onboarding preview';
  assert position('auth.uid()' in v_definition) > 0,
    'the preview must require an authenticated identity';
  assert position('is_active_user' in v_definition) > 0,
    'the preview must reject suspended accounts';
end
$test$;

rollback;
