--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: arquetipos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.arquetipos (
    chave_correspondencia text NOT NULL,
    codigo text,
    tecnico text,
    simbolico text,
    diagnostico text,
    simbolico_texto text,
    mensagem text,
    gatilho_tatil text,
    gatilho_olfato text,
    gatilho_audicao text,
    gatilho_visao text,
    gatilho_paladar text
);


ALTER TABLE public.arquetipos OWNER TO postgres;

--
-- Name: diagnostico_eventos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diagnostico_eventos (
    id integer NOT NULL,
    diagnostico_id integer NOT NULL,
    tipo_evento text NOT NULL,
    observacao text,
    criado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.diagnostico_eventos OWNER TO postgres;

--
-- Name: diagnostico_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.diagnostico_eventos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.diagnostico_eventos_id_seq OWNER TO postgres;

--
-- Name: diagnostico_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.diagnostico_eventos_id_seq OWNED BY public.diagnostico_eventos.id;


--
-- Name: diagnosticos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diagnosticos (
    id integer NOT NULL,
    session_id text NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    telefone text,
    pais_origem text,
    idioma text,
    produto text,
    tipo_relatorio text,
    modelo_pdf text,
    contexto text,
    respostas_numericas jsonb,
    respostas_codificadas jsonb,
    media_vibracional numeric(5,2),
    zona_predominante text,
    codigo_arquetipo text,
    pdf_url text,
    payment_id text,
    status_pagamento text,
    tipo_pagamento text,
    valor_pago numeric(10,2),
    moeda text,
    data_quiz timestamp without time zone,
    data_pagamento timestamp without time zone,
    data_envio_relatorio timestamp without time zone,
    status_processo text,
    criado_em timestamp without time zone DEFAULT now(),
    email_corrigido text,
    data_criacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email_corrigido_enviado boolean DEFAULT false
);


ALTER TABLE public.diagnosticos OWNER TO postgres;

--
-- Name: diagnosticos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.diagnosticos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.diagnosticos_id_seq OWNER TO postgres;

--
-- Name: diagnosticos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.diagnosticos_id_seq OWNED BY public.diagnosticos.id;


--
-- Name: mapa_da_alma; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mapa_da_alma (
    codigo text NOT NULL,
    fruto text,
    nivel_emocional text,
    texto text,
    descricao_estado_da_alma text,
    diagnostico_emocional text,
    exemplo_vida_familiar text,
    exemplo_vida_social text,
    exemplo_vida_profissional text,
    exercicio_de_elevacao text
);


ALTER TABLE public.mapa_da_alma OWNER TO postgres;

--
-- Name: mapa_espiritual; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mapa_espiritual (
    codigo text NOT NULL,
    polaridade text,
    nivel_estado text,
    sinal_comportamental text,
    esfera_familiar text,
    esfera_social text,
    esfera_profissional text,
    esfera_individual text
);


ALTER TABLE public.mapa_espiritual OWNER TO postgres;

--
-- Name: diagnostico_eventos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnostico_eventos ALTER COLUMN id SET DEFAULT nextval('public.diagnostico_eventos_id_seq'::regclass);


--
-- Name: diagnosticos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnosticos ALTER COLUMN id SET DEFAULT nextval('public.diagnosticos_id_seq'::regclass);


--
-- Name: arquetipos arquetipos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arquetipos
    ADD CONSTRAINT arquetipos_pkey PRIMARY KEY (chave_correspondencia);


--
-- Name: diagnostico_eventos diagnostico_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnostico_eventos
    ADD CONSTRAINT diagnostico_eventos_pkey PRIMARY KEY (id);


--
-- Name: diagnosticos diagnosticos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_pkey PRIMARY KEY (id);


--
-- Name: mapa_da_alma mapa_da_alma_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mapa_da_alma
    ADD CONSTRAINT mapa_da_alma_pkey PRIMARY KEY (codigo);


--
-- Name: mapa_espiritual mapa_espiritual_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mapa_espiritual
    ADD CONSTRAINT mapa_espiritual_pkey PRIMARY KEY (codigo);


--
-- Name: diagnostico_eventos diagnostico_eventos_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnostico_eventos
    ADD CONSTRAINT diagnostico_eventos_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(id) ON DELETE CASCADE;


--
-- Name: TABLE arquetipos; Type: ACL; Schema: public; Owner: postgres
--




--
-- Name: TABLE diagnostico_eventos; Type: ACL; Schema: public; Owner: postgres
--




--
-- Name: SEQUENCE diagnostico_eventos_id_seq; Type: ACL; Schema: public; Owner: postgres
--




--
-- Name: TABLE diagnosticos; Type: ACL; Schema: public; Owner: postgres
--




--
-- Name: SEQUENCE diagnosticos_id_seq; Type: ACL; Schema: public; Owner: postgres
--




--
-- Name: TABLE mapa_da_alma; Type: ACL; Schema: public; Owner: postgres
--




--
-- Name: TABLE mapa_espiritual; Type: ACL; Schema: public; Owner: postgres
--




--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO postgres;



--
-- PostgreSQL database dump complete
--

